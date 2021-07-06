//"SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./BridgeMintableToken.sol";
import "./ChainportMiddleware.sol";
import "./interfaces/IValidator.sol";


contract ChainportSideBridge is Initializable, ChainportMiddleware {

    IValidator public signatureValidator;

    mapping(address => address) public erc20ToBep20Address; // Name shouldn't be changed because of upgrading conventions
    mapping(string => uint256) public functionNameToNonce;
    mapping(address => bool) public isCreatedByTheBridge;

    // Mapping if bridge is Frozen
    bool public isFrozen;

    // Network activity state mapping
    mapping(uint256 => bool) public isNetworkActive;

    event TokensMinted(address tokenAddress, address issuer, uint256 amount);
    event TokensBurned(address tokenAddress, address issuer, uint256 amount);
    event TokenCreated(address newTokenAddress, address ethTokenAddress, string tokenName, string tokenSymbol, uint8 decimals);
    event TokensTransferred(address bridgeTokenAddress, address issuer, uint256 amount, uint256 networkId);

    event NetworkActivated(uint256 networkId);
    event NetworkDeactivated(uint256 networkId);

    modifier isNotFrozen {
        require(isFrozen == false, "Error: All Bridge actions are currently frozen.");
        _;
    }

    modifier isAmountGreaterThanZero(uint256 amount) {
        require(amount > 0, "Error: Amount is not greater than zero.");
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
        require(erc20ToBep20Address[erc20_address] == address(0), "Error: Token already exists.");

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
        require(nonce == functionNameToNonce["mintTokens"] + 1, "Error: Nonce is not correct");
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
        require(isCreatedByTheBridge[bep20Token], "Error: Token is not created by the bridge.");

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

    // Function to burn tokens to selected network bridge
    function crossChainTransfer(
        address bridgeToken,
        uint256 amount,
        uint256 networkId
    )
    public
    isAmountGreaterThanZero(amount)
    {
        require(isNetworkActive[networkId], "Error: Network with this id is not supported.");

        require(isCreatedByTheBridge[bridgeToken], "Error: Token is not created by the bridge.");
        BridgeMintableToken token = BridgeMintableToken(bridgeToken);
        token.burnFrom(msg.sender, amount);

        emit TokensTransferred(bridgeToken, msg.sender, amount, networkId);
    }

    // Function to activate selected network
    function activateNetwork(
        uint256 networkId
    )
    public
    onlyMaintainer
    {
        isNetworkActive[networkId] = true;
        emit NetworkActivated(networkId);
    }

    // Function to deactivate selected network
    function deactivateNetwork(
        uint256 networkId
    )
    public
    onlyChainportCongress
    {
        isNetworkActive[networkId] = false;
        emit NetworkDeactivated(networkId);
    }
}
