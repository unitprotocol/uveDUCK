// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import './Interfaces.sol';
import "./Addresses.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';


contract DuckDepositor is Addresses {
    using SafeERC20 for IERC20;
    using Address for address;

    address public constant escrow = veDuck;
    uint256 private constant MAXTIME = 4 * 364 * 86400;
    uint256 private constant WEEK = 7 * 86400;

    uint256 public constant FEE_DENOMINATOR = 10000;

    address public feeManager;
    address public immutable staker;
    address public immutable minter;
    uint256 public unlockTime;

    constructor(address _staker, address _minter) {
        staker = _staker;
        minter = _minter;
        feeManager = msg.sender;
    }

    function setFeeManager(address _feeManager) external {
        require(msg.sender == feeManager, "!auth");
        feeManager = _feeManager;
    }

    function initialLock() external {
        require(msg.sender == feeManager, "!auth");

        uint256 veduck = IERC20(escrow).balanceOf(staker);
        if (veduck == 0) {
            uint256 unlockAt = block.timestamp + MAXTIME;
            uint256 unlockInWeeks = (unlockAt / WEEK) * WEEK;

            //release old lock if exists
            IStaker(staker).release();
            //create new lock
            uint256 duckBalanceStaker = IERC20(duck).balanceOf(staker);
            IStaker(staker).createLock(duckBalanceStaker, unlockAt);
            unlockTime = unlockInWeeks;
        }
    }

    //lock curve
    function _lockCurve() internal {
        uint256 duckBalance = IERC20(duck).balanceOf(address(this));
        if (duckBalance > 0) {
            IERC20(duck).safeTransfer(staker, duckBalance);
        }

        //increase ammount
        uint256 duckBalanceStaker = IERC20(duck).balanceOf(staker);
        if (duckBalanceStaker == 0) {
            return;
        }

        //increase amount
        IStaker(staker).increaseAmount(duckBalanceStaker);


        uint256 unlockAt = block.timestamp + MAXTIME;
        uint256 unlockInWeeks = (unlockAt / WEEK) * WEEK;

        //increase time too if over 2 week buffer
        if (unlockInWeeks - unlockTime > 2) {
            IStaker(staker).increaseTime(unlockAt);
            unlockTime = unlockInWeeks;
        }
    }

    function lockCurve() external {
        _lockCurve();
    }

    //deposit duck for uveDuck and stake to _stakeAddress (suveDuck)
    function deposit(uint256 _amount, address _stakeAddress) public {
        require(_amount > 0, "!>0");

        //lock immediately, transfer directly to staker to skip an erc20 transfer
        IERC20(duck).safeTransferFrom(msg.sender, staker, _amount);
        _lockCurve();

        //mint here
        ITokenMinter(minter).mint(address(this), _amount);
        //stake for msg.sender
        IERC20(minter).safeApprove(_stakeAddress, 0);
        IERC20(minter).safeApprove(_stakeAddress, _amount);
        IRewards(_stakeAddress).stakeFor(msg.sender, _amount);
    }

    function depositAll(address _stakeAddress) external {
        uint256 duckBal = IERC20(duck).balanceOf(msg.sender);
        deposit(duckBal, _stakeAddress);
    }
}