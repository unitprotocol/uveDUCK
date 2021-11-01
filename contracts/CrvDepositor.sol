// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import './Interfaces.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';


contract CrvDepositor {
    using SafeERC20 for IERC20;
    using Address for address;

    address public constant crv = address(0xD533a949740bb3306d119CC777fa900bA034cd52);
    address public constant escrow = address(0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2);
    uint256 private constant MAXTIME = 4 * 364 * 86400;
    uint256 private constant WEEK = 7 * 86400;

    uint256 public constant FEE_DENOMINATOR = 10000;

    address public feeManager;
    address public immutable voteProxy;
    address public immutable uveCrv;
    uint256 public unlockTime;

    constructor(address _voteProxy, address _uveCrv) {
        voteProxy = _voteProxy;
        uveCrv = _uveCrv;
        feeManager = msg.sender;
    }

    function setFeeManager(address _feeManager) external {
        require(msg.sender == feeManager, "!auth");
        feeManager = _feeManager;
    }

    function initialLock() external {
        require(msg.sender == feeManager, "!auth");

        uint256 vecrv = IERC20(escrow).balanceOf(voteProxy);
        if (vecrv == 0) {
            uint256 unlockAt = block.timestamp + MAXTIME;
            uint256 unlockInWeeks = (unlockAt / WEEK) * WEEK;

            //release old lock if exists
            IStaker(voteProxy).release();
            //create new lock
            uint256 crvBalanceStaker = IERC20(crv).balanceOf(voteProxy);
            IStaker(voteProxy).createLock(crvBalanceStaker, unlockAt);
            unlockTime = unlockInWeeks;
        }
    }

    //lock curve
    function _lockCurve() internal {
        uint256 crvBalance = IERC20(crv).balanceOf(address(this));
        if (crvBalance > 0) {
            IERC20(crv).safeTransfer(voteProxy, crvBalance);
        }

        //increase ammount
        uint256 crvBalanceStaker = IERC20(crv).balanceOf(voteProxy);
        if (crvBalanceStaker == 0) {
            return;
        }

        //increase amount
        IStaker(voteProxy).increaseAmount(crvBalanceStaker);


        uint256 unlockAt = block.timestamp + MAXTIME;
        uint256 unlockInWeeks = (unlockAt / WEEK) * WEEK;

        //increase time too if over 2 week buffer
        if (unlockInWeeks - unlockTime > 2) {
            IStaker(voteProxy).increaseTime(unlockAt);
            unlockTime = unlockInWeeks;
        }
    }

    function lockCurve() external {
        _lockCurve();
    }

    //deposit crv for cvxCrv
    function deposit(uint256 _amount, address _stakeAddress) public {
        require(_amount > 0, "!>0");

        //lock immediately, transfer directly to staker to skip an erc20 transfer
        IERC20(crv).safeTransferFrom(msg.sender, voteProxy, _amount);
        _lockCurve();

        //mint here
        ITokenMinter(uveCrv).mint(address(this), _amount);
        //stake for msg.sender
        IERC20(uveCrv).safeApprove(_stakeAddress, 0);
        IERC20(uveCrv).safeApprove(_stakeAddress, _amount);
        IRewards(_stakeAddress).stakeFor(msg.sender, _amount);
    }

    function depositAll(address _stakeAddress) external {
        uint256 crvBal = IERC20(crv).balanceOf(msg.sender);
        deposit(crvBal, _stakeAddress);
    }
}