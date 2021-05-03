pragma solidity ^0.6.12;

/**
 * IValidator contract.
 * @author Nikola Madjarevic
 * Date created: 3.5.21.
 * Github: madjarevicn
 */
interface IValidator {
    function verifyWithdraw(bytes memory signedMessage, address token, uint256 amount, address beneficiary) external view returns (bool);
    function recoverSignature(bytes memory signedMessage, address beneficiary, address token, uint256 amount) public view returns (address);
}