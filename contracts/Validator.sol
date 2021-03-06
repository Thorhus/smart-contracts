//"SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./ChainportMiddleware.sol";

/**
 * Validator contract.
 * @author Nikola Madjarevic
 * Date created: 3.5.21.
 * Github: madjarevicn
 */
contract Validator is Initializable, ChainportMiddleware {

    address public signatoryAddress;

    bytes32 constant private recoverSignatureHash = keccak256(abi.encodePacked('bytes binding user withdrawal'));

    // Set initial signatory address and Chainport congress
    function initialize(
        address _signatoryAddress,
        address _chainportCongress,
        address _maintainersRegistry
    )
    public
    initializer
    {
        signatoryAddress = _signatoryAddress;
        setCongressAndMaintainers(_chainportCongress, _maintainersRegistry);
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
        bytes calldata signedMessage,
        uint256 nonce,
        address beneficiary,
        uint256 amount,
        address token
)
    external
    view
    returns (bool)
    {
        address messageSigner = recoverSignature(signedMessage, nonce, beneficiary, amount, token);
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
        uint256 nonce,
        address beneficiary,
        uint256 amount,
        address token
    )
    public
    pure
    returns (address)
    {
        // Generate hash
        bytes32 hash = keccak256(
            abi.encodePacked(
                recoverSignatureHash,
                keccak256(abi.encodePacked(nonce, beneficiary, amount, token))
            )
        );

        // Recover signer message from signature
        return recoverHash(hash,signedMessage,0);
    }

    /**
     * @notice          Generalized recover sig for hash
     * @dev             Built for easily integrating onwards with new contracts,
     *                  since the message can be hashed on the another contract also.
     * @param           hash is hash generated by encoding and hashing data
     * @param           signature is the signature which should be verified.
     */
    function recoverSigFromHash(bytes32 hash, bytes memory signature)
    public
    view
    returns (bool)
    {
        address signer = recoverHash(hash, signature, 0);
        return signer == signatoryAddress;
    }


    function recoverHash(
        bytes32 hash,
        bytes memory sig,
        uint idx
    )
    public
    pure
    returns (address)
    {
        // same as recoverHash in utils/sign.js
        // The signature format is a compact form of:
        //   {bytes32 r}{bytes32 s}{uint8 v}
        // Compact means, uint8 is not padded to 32 bytes.
        require (sig.length >= 65+idx, 'bad signature length');
        idx += 32;
        bytes32 r;
        assembly
        {
            r := mload(add(sig, idx))
        }

        idx += 32;
        bytes32 s;
        assembly
        {
            s := mload(add(sig, idx))
        }

        idx += 1;
        uint8 v;
        assembly
        {
            v := mload(add(sig, idx))
        }
        if (v >= 32) { // handle case when signature was made with ethereum web3.eth.sign or getSign which is for signing ethereum transactions
            v -= 32;
            bytes memory prefix = "\x19Ethereum Signed Message:\n32"; // 32 is the number of bytes in the following hash
            hash = keccak256(abi.encodePacked(prefix, hash));
        }
        if (v <= 1) v += 27;
        require(v==27 || v==28,'bad sig v');
        //https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/cryptography/ECDSA.sol#L57
        require(uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0, 'bad sig s');

        address signer = ecrecover(hash, v, r, s);
        require(signer != address(0), 'bad signature');

        return signer;

    }

}
