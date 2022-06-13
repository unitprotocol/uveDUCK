// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./Interfaces.sol";
import "./Addresses.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';


contract VoterProxy is Addresses {
    using SafeMath for uint;
    using SafeERC20 for IERC20;
    using Address for address;

    address public constant escrow = veDuck;

    address public owner;
    address public operator; // Booster
    address public depositor;

    constructor() {
        owner = msg.sender;
    }

    function setOwner(address _owner) external {
        require(msg.sender == owner, "!auth");
        owner = _owner;
    }

    function setOperator(address _operator) external {
        require(msg.sender == owner, "!auth");
        require(operator == address(0) || IDeposit(operator).isShutdown() == true, "needs shutdown");

        operator = _operator;
    }

    function setDepositor(address _depositor) external {
        require(msg.sender == owner, "!auth");

        depositor = _depositor;
    }

    function createLock(uint256 _value, uint256 _unlockTime) external returns(bool) {
        require(msg.sender == depositor, "!auth");
        IERC20(duck).safeApprove(escrow, 0);
        IERC20(duck).safeApprove(escrow, _value);
        IVoteEscrow(escrow).create_lock(_value, _unlockTime);
        return true;
    }

    function increaseAmount(uint256 _value) external returns(bool) {
        require(msg.sender == depositor, "!auth");
        IERC20(duck).safeApprove(escrow, 0);
        IERC20(duck).safeApprove(escrow, _value);
        IVoteEscrow(escrow).increase_amount(_value);
        return true;
    }

    function increaseTime(uint256 _value) external returns(bool) {
        require(msg.sender == depositor, "!auth");
        IVoteEscrow(escrow).increase_unlock_time(_value);
        return true;
    }

    function release() external returns(bool) {
        require(msg.sender == depositor, "!auth");
        IVoteEscrow(escrow).withdraw();
        return true;
    }

    function claimFees(address _distroContract, address _token) external returns (uint256) {
        require(msg.sender == operator, "!auth");
        IFeeDistro(_distroContract).claim();
        uint256 _balance = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransfer(operator, _balance);
        return _balance;
    }

    function execute(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external returns (bool, bytes memory) {
        require(msg.sender == operator, "!auth");

        (bool success, bytes memory result) = _to.call{value:_value}(_data);

        return (success, result);
    }

    function read(address _to, bytes calldata _callData) public view returns (bool success, bytes memory data) {
        (success, data) = _to.staticcall(_callData);
    }
}