// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IPDukaOracle {
    function zarToPduka(uint256 zarAmount) external view returns (uint256);
    function pdukaAmountToZar(uint256 pdukaAmount) external view returns (uint256);
    function isStale() external view returns (bool);
}

interface IPDukaTreasury {
    function receiveFunds(uint256 amount) external;
}

contract PDukaPool is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant SETTLER_ROLE  = keccak256("SETTLER_ROLE");

    IERC20 public immutable pduka;
    IPDukaOracle public oracle;
    IPDukaTreasury public treasury;
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // ── Batch tracking ──
    uint256 public batchNonce;

    struct BatchRecord {
        uint256 totalVolumeZarCents;  // off-chain volume in ZAR cents
        uint256 totalVolumeTokens;    // converted via oracle at settlement time
        uint256 burnAmount;           // 0.5% of volume in tokens
        uint256 treasuryAmount;       // 2.0% of volume in tokens
        uint256 pdukaZarRate;         // oracle rate snapshot
        uint256 timestamp;
        bytes32 offChainBatchId;
    }

    mapping(uint256 => BatchRecord) public batches;

    // C8: replay protection — settled batch IDs cannot be reused
    mapping(bytes32 => bool) public usedBatches;

    // ── Withdrawal tracking ──
    uint256 public withdrawalNonce;

    struct Withdrawal {
        address to;
        uint256 tokenAmount;
        uint256 zarEquivalent;
        bytes32 offChainRef;
        uint256 timestamp;
    }

    mapping(uint256 => Withdrawal) public withdrawals;

    // ── Cumulative stats ──
    uint256 public totalBurned;
    uint256 public totalToTreasury;

    // ── Events ──
    event Deposited(address indexed from, uint256 amount, bytes32 offChainRef);
    event BatchSettled(
        uint256 indexed nonce,
        uint256 volumeZarCents,
        uint256 volumeTokens,
        uint256 burned,
        uint256 toTreasury,
        uint256 pdukaZarRate,
        bytes32 offChainBatchId
    );
    event Withdrawn(
        uint256 indexed nonce,
        address indexed to,
        uint256 tokenAmount,
        uint256 zarEquivalent,
        bytes32 offChainRef
    );
    event OracleUpdated(address oldOracle, address newOracle);
    event TreasuryUpdated(address oldTreasury, address newTreasury);

    constructor(
        address _pduka,
        address _treasury,
        address _oracle
    ) {
        pduka = IERC20(_pduka);
        treasury = IPDukaTreasury(_treasury);
        oracle = IPDukaOracle(_oracle);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(SETTLER_ROLE, msg.sender);
    }

    // ── Deposit ──

    function deposit(uint256 amount, bytes32 offChainRef)
        external nonReentrant whenNotPaused
    {
        pduka.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount, offChainRef);
    }

    // ── Batch Settlement ──
    // Backend passes totalVolumeZarCents (sum of all txn amounts in ZAR cents).
    // Contract reads the oracle to convert to token amounts, then burns and skims.

    // The backend supplies burnAmount and treasuryAmount (in tokens). The
    // contract executes them and rejects any duplicate batch ID (C8).
    function batchSettle(
        uint256 totalVolume,
        uint256 burnAmount,
        uint256 treasuryAmount,
        bytes32 offChainBatchId
    ) external onlyRole(SETTLER_ROLE) nonReentrant whenNotPaused {
        require(!usedBatches[offChainBatchId], "Batch already settled");
        usedBatches[offChainBatchId] = true;

        require(
            pduka.balanceOf(address(this)) >= burnAmount + treasuryAmount,
            "Insufficient pool balance"
        );

        // Burn
        pduka.safeTransfer(BURN_ADDRESS, burnAmount);
        totalBurned += burnAmount;

        // Treasury (auto-routes to sub-vaults)
        pduka.approve(address(treasury), treasuryAmount);
        treasury.receiveFunds(treasuryAmount);
        totalToTreasury += treasuryAmount;

        // Record
        uint256 nonce = batchNonce++;
        batches[nonce] = BatchRecord({
            totalVolumeZarCents: totalVolume,
            totalVolumeTokens: totalVolume,
            burnAmount: burnAmount,
            treasuryAmount: treasuryAmount,
            pdukaZarRate: 0,
            timestamp: block.timestamp,
            offChainBatchId: offChainBatchId
        });

        emit BatchSettled(
            nonce,
            totalVolume,
            totalVolume,
            burnAmount,
            treasuryAmount,
            0,
            offChainBatchId
        );
    }

    // ── Withdrawal (merchant off-ramp, customer cash-out) ──

    function withdraw(
        address to,
        uint256 zarCents,
        bytes32 offChainRef
    ) external onlyRole(OPERATOR_ROLE) nonReentrant whenNotPaused {
        require(to != address(0), "Invalid recipient");
        require(!oracle.isStale(), "Oracle rate is stale");

        uint256 zarAmount = zarCents * 1e16;
        uint256 tokenAmount = oracle.zarToPduka(zarAmount);

        require(
            pduka.balanceOf(address(this)) >= tokenAmount,
            "Insufficient pool balance"
        );

        pduka.safeTransfer(to, tokenAmount);

        uint256 nonce = withdrawalNonce++;
        withdrawals[nonce] = Withdrawal({
            to: to,
            tokenAmount: tokenAmount,
            zarEquivalent: zarCents,
            offChainRef: offChainRef,
            timestamp: block.timestamp
        });

        emit Withdrawn(nonce, to, tokenAmount, zarCents, offChainRef);
    }

    // ── Admin ──

    function setOracle(address _oracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit OracleUpdated(address(oracle), _oracle);
        oracle = IPDukaOracle(_oracle);
    }

    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit TreasuryUpdated(address(treasury), _treasury);
        treasury = IPDukaTreasury(_treasury);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    function poolBalance() external view returns (uint256) {
        return pduka.balanceOf(address(this));
    }

    function poolBalanceInZar() external view returns (uint256) {
        return oracle.pdukaAmountToZar(pduka.balanceOf(address(this)));
    }
}
