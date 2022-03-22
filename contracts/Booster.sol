// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./Interfaces.sol";
import "./FeePool.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';


contract Booster is ReentrancyGuard {
    using SafeMath for uint;
    using SafeERC20 for IERC20;
    using Address for address;

    uint256 public earmarkIncentive = 100; //incentive to users who spend gas to make calls
    uint256 public platformFee = 1000; //possible fee to build treasury
    uint256 public constant MaxFees = 5000;
    uint256 public constant FEE_DENOMINATOR = 10000;

    address public owner;
    address public feeManager;
    address public immutable staker;
    address public treasury;
    address public lockFees; // usdp for uveDUCK, no additional fees applied
    address public feeDistro;
    address public feeToken;

    bool public isShutdown;

    event Deposited(address indexed user, uint256 indexed poolid, uint256 amount);
    event Withdrawn(address indexed user, uint256 indexed poolid, uint256 amount);

    // We dont need `minter` since we dont have an additional reward token
    constructor(address _staker) {
        isShutdown = false;
        staker = _staker;
        owner = msg.sender;
        feeManager = msg.sender;
        feeDistro = address(0);
        feeToken = address(0);
        treasury = address(0);
    }


    /// SETTER SECTION ///

    function setOwner(address _owner) external {
        require(msg.sender == owner, "!auth");
        owner = _owner;
    }

    function setFeeManager(address _feeM) external {
        require(msg.sender == feeManager, "!auth");
        feeManager = _feeM;
    }

    function setFeeInfo(address _feeDistro, address _uveduck) external {
        require(msg.sender == feeManager, "!auth");

        feeDistro = _feeDistro;
        address _feeToken = IFeeDistro(_feeDistro).token();
        if (feeToken != _feeToken) {
            //create a new reward contract for the new token
            lockFees = address(new FeePool(_uveduck, _feeToken, address(this)));
            feeToken = _feeToken;
        }
    }

    function setFees(uint256 _callerFees, uint256 _platform) external {
        require(msg.sender == feeManager, "!auth");

        uint256 total = _callerFees.add(_platform);
        require(total <= MaxFees, ">MaxFees");
        require(_callerFees >= 1 && _callerFees <= 100, "values must be within certain ranges");

        earmarkIncentive = _callerFees;
        platformFee = _platform;
    }

    function setTreasury(address _treasury) external {
        require(msg.sender == feeManager, "!auth");
        treasury = _treasury;
    }

    /// END SETTER SECTION ///

    //shutdown this contract.
    //  unstake and pull all lp tokens to this address
    //  only allow withdrawals
    function shutdownSystem() external {
        require(msg.sender == owner, "!auth");
        isShutdown = true;
    }

    //claim fees from distro contract, put in lockers' reward contract
    function earmarkFees() external nonReentrant returns(bool) {
        //claim fee rewards
        IStaker(staker).claimFees(feeDistro, feeToken);
        //send fee rewards to reward contract
        uint256 _balance = IERC20(feeToken).balanceOf(address(this));
        if (_balance == 0) {
            return true;
        }

        uint256 callIncentive = _balance.mul(earmarkIncentive).div(FEE_DENOMINATOR);

        if (platformFee > 0 && treasury != address(0)) {
            uint fee = _balance.mul(platformFee).div(FEE_DENOMINATOR);
            IERC20(feeToken).safeTransfer(treasury, fee);
            _balance = _balance.sub(fee);
        }

        _balance = _balance.sub(callIncentive);
        IERC20(feeToken).safeTransfer(msg.sender, callIncentive);

        IERC20(feeToken).safeTransfer(lockFees, _balance);
        IRewards(lockFees).queueNewRewards(_balance);
        return true;
    }
}