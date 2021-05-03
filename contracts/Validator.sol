//"SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./libraries/Call.sol";

/**
 * Validator contract.
 * @author Nikola Madjarevic
 * Date created: 3.5.21.
 * Github: madjarevicn
 */
contract Validator is Initializable {
    using Call for *;

    address public signatoryAddress;
    address public chainportCongress;

    modifier onlyChainportCongress {
        require(msg.sender == chainportCongress);
        _;
    }

    // Set initial signatory address and Chainport congress
    function initialize(
        address _signatoryAddress,
        address _chainportCongress
    )
    public
    initializer
    {
        signatoryAddress = _signatoryAddress;
        chainportCongress = _chainportCongress;
    }

    // Set / change signatory address
    function setSignatoryAddress(
        address _signatoryAddress
    )
    public
    onlyChainportCongress
    {
        require(_signatoryAddress != address(0));
        signatoryAddress = _signatoryAddress;
    }

    /**
     * @notice          Function to verify withdraw parameters and if signatory signed message
     * @param           signedMessage is the message to verify
     * @param           beneficiary is the address of user for who we signed message
     * @param           token is the address of the token being withdrawn
     * @param           amount is the amount of tokens user is attempting to withdraw
     */
    function verifyWithdraw(
        bytes memory signedMessage,
        address token,
        uint256 amount,
        address beneficiary
    )
    external
    view
    returns (bool)
    {
        address messageSigner = recoverSignature(signedMessage, beneficiary, token, amount);
        return messageSigner == signatoryAddress;
    }

    /**
     * @notice          Function to can check who signed the message
     * @param           signedMessage is the message to verify
     * @param           beneficiary is the address of user for who we signed message
     * @param           token is the address of the token being withdrawn
     * @param           amount is the amount of tokens user is attempting to withdraw
     */
    function recoverSignature(
        bytes memory signedMessage,
        address beneficiary,
        address token,
        uint256 amount
    )
    public
    pure
    returns (address)
    {
        // Generate hash
        bytes32 hash = keccak256(
            abi.encodePacked(
                keccak256(abi.encodePacked('bytes binding user withdrawal')),
                keccak256(abi.encodePacked(beneficiary, token, amount))
            )
        );

        // Recover signer message from signature
        return Call.recoverHash(hash,signedMessage,0);
    }

}
