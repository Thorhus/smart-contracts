//"SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./BridgeMintableToken.sol";
import "./ChainportMiddleware.sol";
import "./interfaces/IValidator.sol";


contract ChainportBridgeBsc is Initializable, ChainportMiddleware {

    IValidator public signatureValidator;

    mapping(address => address) public erc20ToBridgeTokenAddress;
    mapping(string => uint256) public functionNameToNonce;
    mapping(address => bool) public isCreatedByTheBridge;

    // Mapping if bridge is Frozen
    bool public isFrozen;

    // Network mappings
    mapping(uint8 => string) public networkNameById;
    mapping(uint8 => bool) public isNetworkActivated;

    // Number of networks used also for id
    uint8 public numberOfNetworks;

    event TokensMinted(address tokenAddress, address issuer, uint256 amount);
    event TokensBurned(address tokenAddress, address issuer, uint256 amount);
    event TokenCreated(address newTokenAddress, address ethTokenAddress, string tokenName, string tokenSymbol, uint8 decimals);
    event TokensTransfer(address bridgeTokenAddress, address issuer, uint256 amount, uint8 networkId);

    event NetworkAdded(string networkName, uint8 networkId);
    event NetworkActivated(string networkName, uint8 networkId);
    event NetworkDeactivated(string networkName, uint8 networkId);

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
        require(erc20ToBridgeTokenAddress[erc20_address] == address(0), "MintNewToken: Token already exists.");

        BridgeMintableToken newToken = new BridgeMintableToken(tokenName, tokenSymbol, decimals);

        erc20ToBridgeTokenAddress[erc20_address] = address(newToken);
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
            isCreatedByTheBridge[erc20ToBridgeTokenAddress[erc20addresses[i]]] = false;
            delete erc20ToBridgeTokenAddress[erc20addresses[i]];
        }
    }

    function crossChainTransfer(
        address bridgeToken,
        uint256 amount,
        uint8 networkId
    )
    public
    isAmountGreaterThanZero(amount)
    {
        require(isNetworkActivated[networkId] == true, "Invalid blockchain ID.");

        require(isCreatedByTheBridge[bridgeToken], "BurnTokens: Token is not created by the bridge.");
        BridgeMintableToken token = BridgeMintableToken(bridgeToken);
        token.burnFrom(msg.sender, amount);

        emit TokensTransfer(bridgeToken, msg.sender, amount, networkId);
    }

    function addNetwork(
        string memory networkName
    )
    public
    onlyMaintainer
    {
        // Using numberOfNetworks as an id for new network
        networkNameById[numberOfNetworks] = networkName;
        isNetworkActivated[numberOfNetworks] = true;

        emit NetworkAdded(networkName, numberOfNetworks);
        numberOfNetworks++;
    }

    function activateSupportedNetwork(
        uint8 networkId
    )
    public
    onlyMaintainer
    {
        isNetworkActivated[networkId] = true;
        emit NetworkActivated(networkNameById[networkId], networkId);
    }

    function deactivateSupportedNetwork(
        uint8 networkId
    )
    public
    onlyChainportCongress
    {
        isNetworkActivated[networkId] = false;
        emit NetworkDeactivated(networkNameById[networkId], networkId);
    }
}
