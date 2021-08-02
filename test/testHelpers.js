const ethUtil = require("ethereumjs-util");
const Web3 = require('web3');

const signatoryAddress = "0xA9664FDf800930e5E5E879bCf8CE290943F1E30D";
// *** Dummy PK only for testing purposes ***
const signatoryPk = "32c069bf3d38a060eacdc072eecd4ef63f0fc48895afbacbe185c97037789875";

function generateSignature(digest, privateKey) {
    // prefix with "\x19Ethereum Signed Message:\n32"
    // Reference: https://github.com/OpenZeppelin/openzeppelin-contracts/issues/890
    const prefixedHash = ethUtil.hashPersonalMessage(ethUtil.toBuffer(digest));

    // sign message
    const {v, r, s} = ethUtil.ecsign(prefixedHash, Buffer.from(privateKey, 'hex'))
    //console.log(v,r,s);

    // generate signature by concatenating r(32), s(32), v(1) in this order
    // Reference: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/76fe1548aee183dfcc395364f0745fe153a56141/contracts/ECRecovery.sol#L39-L43
    const vb = Buffer.from([v]); // v is uint by default
    const signature = Buffer.concat([r, s, vb]);

    //console.log(signature.toString('hex'));
    return(signature);
}

function createHash(nonce, beneficiary, amount, token, privateKey) {
    // compute keccak256(abi.encodePacked(nonce, beneficiary, amount, token))
    const digestHash = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ['uint256', 'address', 'uint256', 'address'],
            [nonce, beneficiary, amount, token]
        )
    );
    console.log("First hash", digestHash);
    const digestMsg = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ['string'],
            ['bytes binding user withdrawal']
        )
    );
    console.log("Second hash", digestMsg);
    const digestFinal = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ['bytes32', 'bytes32'],
            [digestMsg, digestHash]
        )
    );
    console.log("Main hash", digestFinal);

    // const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
    // let result = web3.eth.accounts.sign(digestFinal, privateKey);
    // console.log("result", result)
    // return result.signature;
    return generateSignature(digestFinal, privateKey);
}

module.exports = {
    signatoryAddress,
    signatoryPk,
    createHash
}
