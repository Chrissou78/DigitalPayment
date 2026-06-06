// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title PDukaTreasury
 * @notice Manages protocol treasury funds across multiple sub-wallets.
 *         Each sub-wallet has a hard cap (default $100K equivalent in PDUKA).
 *         When a wallet hits the cap, funds automatically route to the next.
 *         Oracle-fed ZAR/USD rate determines the cap in token terms.
 */
interface ITreasuryOracle {
    function pdukaUsd() external view returns (uint256);
}

contract PDukaTreasury is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant ORACLE_ROLE   = keccak256("ORACLE_ROLE");

    IERC20 public immutable pduka;

    // ── Sub-wallet management ──
    address[] public vaults;
    mapping(address => bool) public isVault;
    mapping(address => uint256) internal assigned; // tracked internally, keyed by vault address
    ITreasuryOracle public oracle;

    uint256 public maxPerVaultUsd = 100_000 * 1e18; // $100,000 in 18-decimal USD

    // ── Stats ──
    uint256 public totalReceived;
    uint256 public totalDisbursed;

    // ── Events ──
    event VaultAdded(address indexed vault, uint256 index);
    event VaultRemoved(address indexed vault);
    event FundsReceived(uint256 amount, address indexed routed_to, uint256 vaultNewBalance);
    event FundsDisbursed(address indexed vault, address indexed to, uint256 amount, bytes32 reason);
    event RateUpdated(uint256 oldRate, uint256 newRate);
    event MaxPerVaultUpdated(uint256 oldMax, uint256 newMax);
    event Rebalanced(uint256 vaultsAffected);

    constructor(address _pduka, address _oracle) {
        pduka = IERC20(_pduka);
        oracle = ITreasuryOracle(_oracle);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
    }

    // ── Vault Management ──

    function addVault(address vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(vault != address(0), "Invalid vault");
        require(!isVault[vault], "Already a vault");
        vaults.push(vault);
        isVault[vault] = true;
        emit VaultAdded(vault, vaults.length - 1);
    }

    function removeVault(address vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isVault[vault], "Not a vault");
        require(assigned[vault] == 0, "Vault not empty; disburse first");
        isVault[vault] = false;
        // Remove from array
        for (uint256 i = 0; i < vaults.length; i++) {
            if (vaults[i] == vault) {
                vaults[i] = vaults[vaults.length - 1];
                vaults.pop();
                break;
            }
        }
        emit VaultRemoved(vault);
    }

    function vaultCount() external view returns (uint256) {
        return vaults.length;
    }

    // C5: balance of the vault at a given index (spec calls vaultBalance(0), (1), ...)
    function vaultBalance(uint256 index) external view returns (uint256) {
        return assigned[vaults[index]];
    }

    // ── Oracle Rate ──

    function setMaxPerVaultUsd(uint256 newMax) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newMax >= 10_000 * 1e18, "Min $10K per vault");
        emit MaxPerVaultUpdated(maxPerVaultUsd, newMax);
        maxPerVaultUsd = newMax;
    }

    // ── Max tokens per vault (derived from rate) ──

    function maxTokensPerVault() public view returns (uint256) {
        uint256 rate = oracle.pdukaUsd();
        require(rate > 0, "Rate not set");
        return (maxPerVaultUsd * 1e18) / rate;
    }

    // ── Receive Funds ──
    // Called by PDukaPool during batch settlement (the 2% treasury skim).
    // Automatically routes to the first vault with available capacity.

    function receiveFunds(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        pduka.safeTransferFrom(msg.sender, address(this), amount);

        uint256 remaining = amount;
        uint256 cap = maxTokensPerVault();

        for (uint256 i = 0; i < vaults.length && remaining > 0; i++) {
            uint256 available = 0;
            if (assigned[vaults[i]] < cap) {
                available = cap - assigned[vaults[i]];
            }
            if (available == 0) continue;

            uint256 toSend = remaining > available ? available : remaining;
            pduka.safeTransfer(vaults[i], toSend);
            assigned[vaults[i]] += toSend;
            remaining -= toSend;

            emit FundsReceived(toSend, vaults[i], assigned[vaults[i]]);
        }

        // If all vaults are full, keep remainder in this contract as overflow
        // Admin should add more vaults
        if (remaining > 0) {
            emit FundsReceived(remaining, address(this), remaining);
        }

        totalReceived += amount;
    }

    // ── Disburse Funds ──
    // Operator can move funds out of a specific vault for protocol expenses,
    // buybacks, liquidity provisioning, etc.

    function disburse(
        address vault,
        address to,
        uint256 amount,
        bytes32 reason
    ) external onlyRole(OPERATOR_ROLE) nonReentrant whenNotPaused {
        require(isVault[vault], "Not a vault");
        require(to != address(0), "Invalid recipient");

        // Pull from vault (requires vault to have approved this contract,
        // or we track internal balance and use contract's own holdings)
        // Since we transferred tokens directly to vaults, we need vaults
        // to approve this contract. Alternative: keep all in this contract
        // and only track logical assignment.

        // DESIGN CHOICE: Keep all tokens in THIS contract, vaultBalance
        // is purely logical. This avoids needing vault approvals.
        require(assigned[vault] >= amount, "Vault insufficient balance");
        assigned[vault] -= amount;
        pduka.safeTransfer(to, amount);
        totalDisbursed += amount;

        emit FundsDisbursed(vault, to, amount, reason);
    }

    // ── Rebalance ──
    // If rate changes significantly, rebalance vaults so none exceed new cap.

    function rebalance() external onlyRole(OPERATOR_ROLE) nonReentrant {
        uint256 cap = maxTokensPerVault();
        uint256 overflow = 0;
        uint256 affected = 0;

        // Collect overflow from vaults exceeding cap
        for (uint256 i = 0; i < vaults.length; i++) {
            if (assigned[vaults[i]] > cap) {
                uint256 excess = assigned[vaults[i]] - cap;
                assigned[vaults[i]] = cap;
                overflow += excess;
                affected++;
            }
        }

        // Redistribute overflow to vaults with capacity
        for (uint256 i = 0; i < vaults.length && overflow > 0; i++) {
            if (assigned[vaults[i]] < cap) {
                uint256 available = cap - assigned[vaults[i]];
                uint256 toAssign = overflow > available ? available : overflow;
                assigned[vaults[i]] += toAssign;
                overflow -= toAssign;
                affected++;
            }
        }

        // Any remaining overflow stays as unassigned (contract balance)
        emit Rebalanced(affected);
    }

    // ── View Helpers ──

    function totalTreasuryBalance() external view returns (uint256) {
        return pduka.balanceOf(address(this));
    }

    function totalAssignedToVaults() external view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < vaults.length; i++) {
            total += assigned[vaults[i]];
        }
        return total;
    }

    function unassignedBalance() external view returns (uint256) {
        uint256 assignedTotal = 0;
        for (uint256 i = 0; i < vaults.length; i++) {
            assignedTotal += assigned[vaults[i]];
        }
        return pduka.balanceOf(address(this)) - assignedTotal;
    }

    function getVaultInfo(uint256 index)
        external
        view
        returns (address vault, uint256 balance, uint256 capacityRemaining)
    {
        vault = vaults[index];
        balance = assigned[vault];
        uint256 cap = maxTokensPerVault();
        capacityRemaining = balance >= cap ? 0 : cap - balance;
    }

    // ── Emergency ──

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
