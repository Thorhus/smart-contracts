//"SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./BridgeMintableToken.sol";
import "./ChainportMiddleware.sol";
import "./interfaces/IValidator.sol";


contract ChainportBridgeBsc is Initializable, ChainportMiddleware {

    IValidator public signatureValidator;

    mapping(address => address) public erc20ToBep20Address;
    mapping(string => uint256) public functionNameToNonce;
    mapping(address => bool) public isCreatedByTheBridge;

    // Mapping if bridge is Frozen
    bool public isFrozen;

    struct Network {
        string chainName;
        uint8 chainId;
        bool isSupported;
    }

    // uint represents local id, starts from 1
    mapping (uint => Network) networks;

    uint8 public numberOfBlockchains;

    event TokensMinted(address tokenAddress, address issuer, uint256 amount);
    event TokensBurned(address tokenAddress, address issuer, uint256 amount);
    event TokenCreated(address newTokenAddress, address ethTokenAddress, string tokenName, string tokenSymbol, uint8 decimals);
    event TokensTransfer(address tokenAddress, address issuer, uint256 amount, uint8 chainId);

    event BlockchainAdded(string blockchainName, uint8 chainId);
    event BlockchainRemoved(string blockchainName, uint8 chianId);

    modifier isNotFrozen {
        require(isFrozen == false, "Error: All Bridge actions are currently frozen.");
        _;
    }

    modifier isAmountGreaterThanZero(uint256 amount) {
        require(amount > 0, "Amount is not greater than zero.");
        _;
    }

    // Set initial addresses
    function initialize(
        address _chainportCongress,
        address _maintainersRegistry
    )
    public
    initializer
    {

        setCongressAndMaintainers(_chainportCongress, _maintainersRegistry);
    }

    function freezeBridge()
    public
    onlyMaintainer
    {
        isFrozen = true;
    }

    function unfreezeBridge()
    public
    onlyChainportCongress
    {
        isFrozen = false;
    }

    function mintNewToken(
        address erc20_address,
        string memory tokenName,
        string memory tokenSymbol,
        uint8 decimals
    )
    public
    onlyMaintainer
    isNotFrozen
    {
        require(erc20ToBep20Address[erc20_address] == address(0), "MintNewToken: Token already exists.");

        BridgeMintableToken newToken = new BridgeMintableToken(tokenName, tokenSymbol, decimals);

        erc20ToBep20Address[erc20_address] = address(newToken);
        isCreatedByTheBridge[address(newToken)] = true;
        emit TokenCreated(address(newToken), erc20_address, tokenName, tokenSymbol, decimals);
    }

    function mintTokens(
        address token,
        address receiver,
        uint256 amount,
        uint256 nonce
    )
    public
    onlyMaintainer
    isNotFrozen
    isAmountGreaterThanZero(amount)
    {
        require(nonce == functionNameToNonce["mintTokens"] + 1, "Nonce is not correct");
        functionNameToNonce["mintTokens"] = nonce;

        BridgeMintableToken ercToken = BridgeMintableToken(token);
        ercToken.mint(receiver, amount);
        emit TokensMinted(token, msg.sender, amount);
    }


    function burnTokens(
        address bep20Token,
        uint256 amount
    )
    public
    isAmountGreaterThanZero(amount)
    {
        require(isCreatedByTheBridge[bep20Token], "BurnTokens: Token is not created by the bridge.");

        BridgeMintableToken token = BridgeMintableToken(bep20Token);
        token.burnFrom(msg.sender, amount);
        emit TokensBurned(address(token), msg.sender, amount);
    }

    // Function to clear up the state and delete mistakenly minted tokens.
    function deleteMintedTokens(address [] memory erc20addresses) public onlyMaintainer {
        for(uint i = 0; i < erc20addresses.length; i++) {
            isCreatedByTheBridge[erc20ToBep20Address[erc20addresses[i]]] = false;
            delete erc20ToBep20Address[erc20addresses[i]];
        }
    }

    function crossChainTransfer(
        address bep20Token,
        uint256 amount,
        uint8 chainId
    )
    public
    isAmountGreaterThanZero(amount)
    {
        require(chainId < numberOfBlockchains && bytes(supportedBlockchains[chainId]).length != 0, "Invalid blockchain ID.");

        require(isCreatedByTheBridge[bep20Token], "BurnTokens: Token is not created by the bridge.");
        BridgeMintableToken token = BridgeMintableToken(bep20Token);
        token.burnFrom(msg.sender, amount);

        emit TokensTransfer(bep20Token, msg.sender, amount, chainId);
    }

    function addSupportedBlockchain(
        string memory blockchainName
    )
    public
    onlyMaintainer
    {
        require(bytes(blockchainName).length != 0, "Invalid blockchain name");

        supportedBlockchains.push(blockchainName);
        numberOfBlockchains++;

        emit BlockchainAdded(blockchainName, uint8(supportedBlockchains.length) - 1);
    }

    function removeSupportedBlockchain(
        uint8 chainId
    )
    public
    onlyChainportCongress
    {
        string memory blockchainName = supportedBlockchains[chainId];
        delete supportedBlockchains[chainId];
        emit BlockchainRemoved(blockchainName, chainId);
    }
}
