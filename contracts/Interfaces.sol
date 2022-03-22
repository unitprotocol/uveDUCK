// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

interface IVoteEscrow {
    function create_lock(uint256, uint256) external;
    function increase_amount(uint256) external;
    function increase_unlock_time(uint256) external;
    function withdraw() external;
    function smart_wallet_checker() external view returns (address);

    function commit_smart_wallet_checker(address addr) external;
    function apply_smart_wallet_checker() external;
}

interface IStaker {
    function createLock(uint256, uint256) external;
    function increaseAmount(uint256) external;
    function increaseTime(uint256) external;
    function release() external;
    function claimFees(address,address) external;
    function operator() external view returns (address);
    function execute(address _to, uint256 _value, bytes calldata _data) external returns (bool, bytes memory);
}

interface IRewards {
    function stake(address, uint256) external;
    function stakeFor(address, uint256) external;
    function withdraw(address, uint256) external;
    function exit(address) external;
    function getReward(address) external;
    function queueNewRewards(uint256) external;
    function notifyRewardAmount(uint256) external;
    function addExtraReward(address) external;
    function stakingToken() external view returns (address);
    function rewardToken() external view returns(address);
    function earned(address account) external view returns (uint256);
}


interface IFeeDistro {
    function claim() external;
    function token() external view returns(address);
}

interface ITokenMinter{
    function mint(address,uint256) external;
    function burn(address,uint256) external;
}

interface IDeposit {
    function isShutdown() external view returns(bool);
    function owner() external returns(address);
}

interface IVestedEscrow {
    function fund(address[] calldata _recipient, uint256[] calldata _amount) external returns(bool);
}

interface ISmartWalletAllowList {
    function approveWallet(address _wallet) external;
}

interface IVault {
    function collaterals(address asset, address owner) external view returns(uint256);
}

interface IRewardHook {
    function onRewardClaim() external;
}

interface IBurner {
    function withdraw_admin_fees(address) external;
    function burn(address) external;
    function execute() external returns(bool);
}

interface IPreDepositChecker {
    function canDeposit(address, uint, uint) external view returns(bool);
}

