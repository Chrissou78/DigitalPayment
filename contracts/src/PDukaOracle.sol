// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title PDukaOracle
 * @notice Provides PDUKA/ZAR rate from two sources:
 *         1. PDUKA/USD — from QuickSwap TWAP or admin-set during early stage
 *         2. USD/ZAR  — from Chainlink oracle on Polygon
 *
 *         During pre-listing phase (before DEX liquidity), the PDUKA/USD rate
 *         is set manually by the ORACLE_ROLE (matches ICO price).
 *         Post-listing, it switches to the DEX TWAP feed.
 */
contract PDukaOracle is AccessControl {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    // All rates stored with 18 decimals of precision
    uint256 public pdukaUsd;    // PDUKA price in USD (e.g., 0.005 = 5e15)
    uint256 public usdZar;      // USD/ZAR rate (e.g., 18.50 = 18.5e18)
    uint256 public lastUpdated;

    // Chainlink USD/ZAR feed on Polygon (if available)
    // For now, manually updated; can plug in AggregatorV3Interface later
    bool public useChainlinkForFx = false;

    // Staleness threshold — rates older than this are considered stale
    uint256 public stalenessThreshold = 1 hours;

    // ── Events ──
    event PdukaUsdUpdated(uint256 oldRate, uint256 newRate, uint256 timestamp);
    event UsdZarUpdated(uint256 oldRate, uint256 newRate, uint256 timestamp);
    event StalenessThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    constructor(uint256 _initialPdukaUsd, uint256 _initialUsdZar) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);

        pdukaUsd = _initialPdukaUsd;
        usdZar = _initialUsdZar;
        lastUpdated = block.timestamp;
    }

    // ── Rate Updates ──

    function setPdukaUsd(uint256 rate) external onlyRole(ORACLE_ROLE) {
        require(rate > 0, "Rate must be > 0");
        emit PdukaUsdUpdated(pdukaUsd, rate, block.timestamp);
        pdukaUsd = rate;
        lastUpdated = block.timestamp;
    }

    function setUsdZar(uint256 rate) external onlyRole(ORACLE_ROLE) {
        require(rate > 0, "Rate must be > 0");
        emit UsdZarUpdated(usdZar, rate, block.timestamp);
        usdZar = rate;
        lastUpdated = block.timestamp;
    }

    function updateRates(uint256 _pdukaUsd, uint256 _usdZar) external onlyRole(ORACLE_ROLE) {
        require(_pdukaUsd > 0 && _usdZar > 0, "Rate must be > 0");
        emit PdukaUsdUpdated(pdukaUsd, _pdukaUsd, block.timestamp);
        emit UsdZarUpdated(usdZar, _usdZar, block.timestamp);
        pdukaUsd = _pdukaUsd;
        usdZar = _usdZar;
        lastUpdated = block.timestamp;
    }

    function setStalenessThreshold(uint256 t) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit StalenessThresholdUpdated(stalenessThreshold, t);
        stalenessThreshold = t;
    }

    // ── Derived Rates ──

    /// @notice Returns PDUKA price in ZAR with 18 decimals
    /// @dev pdukaZar = pdukaUsd * usdZar / 1e18
    function pdukaToZar() external view returns (uint256) {
        require(!isStale(), "Oracle rate is stale");
        return (pdukaUsd * usdZar) / 1e18;
    }

    /// @notice Convert a ZAR amount (18 decimals) to PDUKA tokens (18 decimals)
    function zarToPduka(uint256 zarAmount) external view returns (uint256) {
        require(!isStale(), "Oracle rate is stale");
        uint256 pZar = (pdukaUsd * usdZar) / 1e18;
        require(pZar > 0, "PDUKA/ZAR rate is zero");
        return (zarAmount * 1e18) / pZar;
    }

    /// @notice Convert PDUKA tokens (18 decimals) to ZAR amount (18 decimals)
    function pdukaAmountToZar(uint256 pdukaAmount) external view returns (uint256) {
        require(!isStale(), "Oracle rate is stale");
        uint256 pZar = (pdukaUsd * usdZar) / 1e18;
        return (pdukaAmount * pZar) / 1e18;
    }

    function isStale() public view returns (bool) {
        return block.timestamp - lastUpdated > stalenessThreshold;
    }
}
