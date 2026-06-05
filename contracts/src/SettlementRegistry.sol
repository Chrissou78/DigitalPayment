// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract SettlementRegistry is AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    struct Settlement {
        bytes32 txnId;
        address merchantWallet;
        uint256 grossAmount;
        uint256 fee;
        uint256 reserveAmount;
        uint256 netAmount;
        uint256 timestamp;
    }

    mapping(bytes32 => Settlement) public settlements;
    uint256 public totalSettled;
    uint256 public totalFees;
    uint256 public totalBurned;

    event Settled(
        bytes32 indexed txnId,
        address indexed merchant,
        uint256 netAmount,
        uint256 fee,
        uint256 timestamp
    );

    event TokensBurned(uint256 amount, uint256 totalBurned);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    function recordSettlement(
        bytes32 _txnId,
        address _merchant,
        uint256 _gross,
        uint256 _fee,
        uint256 _reserve
    ) external onlyRole(OPERATOR_ROLE) {
        require(settlements[_txnId].timestamp == 0, "Already settled");

        uint256 net = _gross - _fee;

        settlements[_txnId] = Settlement({
            txnId: _txnId,
            merchantWallet: _merchant,
            grossAmount: _gross,
            fee: _fee,
            reserveAmount: _reserve,
            netAmount: net,
            timestamp: block.timestamp
        });

        totalSettled += _gross;
        totalFees += _fee;

        emit Settled(_txnId, _merchant, net, _fee, block.timestamp);
    }

    function recordBurn(uint256 _amount) external onlyRole(OPERATOR_ROLE) {
        totalBurned += _amount;
        emit TokensBurned(_amount, totalBurned);
    }
}
