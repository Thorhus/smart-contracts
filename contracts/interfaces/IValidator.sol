// "SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

/**
 * IValidator contract.
 * @author Nikola Madjarevic
 * Date created: 3.5.21.
 * Github: madjarevicn
 */
interface IValidator {
    //nonce, beneficiary, amount, token
    function verifyWithdraw(bytes calldata signedMessage, uint256 nonce, address beneficiary, uint256 amount, address token) external view returns (bool);
    function verifyMint(bytes calldata signedMessage, uint256 nonce, address beneficiary, uint256 amount, address token, uint256 networkId) external view returns (bool);
}
