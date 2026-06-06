// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract StakingPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable pduka;

    uint256 public apyBps = 1200; // 12% default, adjustable
    uint256 public constant BPS = 10_000;
    uint256 public constant SECONDS_PER_YEAR = 365.25 days;

    struct Stake {
        uint256 amount;
        uint256 since;
        uint256 claimedRewards;
    }

    mapping(address => Stake) public stakes;
    uint256 public totalStaked;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount, uint256 reward);
    event RewardClaimed(address indexed user, uint256 reward);
    event ApyUpdated(uint256 oldApy, uint256 newApy);

    constructor(address _pduka) Ownable(msg.sender) {
        pduka = IERC20(_pduka);
    }

    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Cannot stake 0");

        // If already staking, claim pending rewards first
        if (stakes[msg.sender].amount > 0) {
            _claimRewards(msg.sender);
        }

        pduka.safeTransferFrom(msg.sender, address(this), amount);

        stakes[msg.sender].amount += amount;
        stakes[msg.sender].since = block.timestamp;
        totalStaked += amount;

        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external nonReentrant {
        Stake storage s = stakes[msg.sender];
        require(s.amount > 0, "Nothing staked");
        require(amount > 0 && amount <= s.amount, "Invalid unstake amount");

        uint256 reward = _pendingReward(msg.sender);

        s.amount -= amount;
        s.since = block.timestamp;
        s.claimedRewards = 0;
        totalStaked -= amount;

        pduka.safeTransfer(msg.sender, amount + reward);
        emit Unstaked(msg.sender, amount, reward);
    }

    function claimRewards() external nonReentrant {
        _claimRewards(msg.sender);
    }

    function setApy(uint256 newApyBps) external onlyOwner {
        require(newApyBps <= 2000, "APY too high"); // max 20%
        emit ApyUpdated(apyBps, newApyBps);
        apyBps = newApyBps;
    }

    function pendingReward(address user) external view returns (uint256) {
        return _pendingReward(user);
    }

    function pendingRewards(address user) external view returns (uint256) {
        return _pendingReward(user);
    }

    function stakedBalance(address user) external view returns (uint256) {
        return stakes[user].amount;
    }

    function _pendingReward(address user) internal view returns (uint256) {
        Stake storage s = stakes[user];
        if (s.amount == 0) return 0;
        uint256 elapsed = block.timestamp - s.since;
        return (s.amount * apyBps * elapsed) / (BPS * SECONDS_PER_YEAR) - s.claimedRewards;
    }

    function _claimRewards(address user) internal {
        uint256 reward = _pendingReward(user);
        if (reward == 0) return;
        stakes[user].claimedRewards += reward;
        pduka.safeTransfer(user, reward);
        emit RewardClaimed(user, reward);
    }
}
