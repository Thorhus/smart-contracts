//"SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./BridgeMintableToken.sol";
import "./ChainportMiddleware.sol";
import "./interfaces/IValidator.sol";


contract ChainportSideBridge is Initializable, ChainportMiddleware {

    IValidator public signatureValidator;

    mapping(address => address) public erc20ToBep20Address; // Name can't be changed because of upgrading conventions
    mapping(string => uint256) public functionNameToNonce;  // Cannot be removed because of upgrading conventions
    mapping(address => bool) public isCreatedByTheBridge;

    // Mapping if bridge is Frozen
    bool public isFrozen;

    // Network activity state mapping
    mapping(uint256 => bool) public isNetworkActive;
    // Nonce check mapping
    mapping(bytes32 => bool) public isNonceUsed;
    // New mapping replacement for old erc20ToBep20Address (multi network adaptation)
    mapping(address => address) public originalAssetToBridgeToken;
    // Security variable used for maintainer one time actions check used for upgrading
    bool public maintainerWorkInProgress;

    event TokensMinted(address tokenAddress, address issuer, uint256 amount);
    event TokensBurned(address tokenAddress, address issuer, uint256 amount);
    event TokenCreated(address newTokenAddress, address ethTokenAddress, string tokenName, string tokenSymbol, uint8 decimals);
    event TokensTransferred(address bridgeTokenAddress, address issuer, uint256 amount, uint256 networkId);

    event NetworkActivated(uint256 networkId);
    event NetworkDeactivated(uint256 networkId);

    event MaintainerWorkInProgress(bool isMaintainerWorkInProgress);

    modifier isBridgeNotFrozen {
        require(isFrozen == false, "Error: All Bridge actions are currently frozen.");
        _;
    }

    modifier isAmountGreaterThanZero(uint256 amount) {
        require(amount > 0, "Error: Amount is not greater than zero.");
        _;
    }

    modifier maintainerWorkNotInProgress {
        require(!maintainerWorkInProgress, "Maintainer actions are being performed at the moment.");
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
        address originalTokenAddress,
        string memory tokenName,
        string memory tokenSymbol,
        uint8 decimals
    )
    public
    onlyMaintainer
    isBridgeNotFrozen
    maintainerWorkNotInProgress
    {
        require(originalAssetToBridgeToken[originalTokenAddress] == address(0), "Error: Token already exists.");

        BridgeMintableToken newToken = new BridgeMintableToken(tokenName, tokenSymbol, decimals);

        originalAssetToBridgeToken[originalTokenAddress] = address(newToken);
        isCreatedByTheBridge[address(newToken)] = true;
        emit TokenCreated(address(newToken), originalTokenAddress, tokenName, tokenSymbol, decimals);
    }

    function mintTokens(
        address token,
        address receiver,
        uint256 amount,
        uint256 nonce
    )
    public
    onlyMaintainer
    isBridgeNotFrozen
    isAmountGreaterThanZero(amount)
    maintainerWorkNotInProgress
    {
        bytes32 nonceHash = keccak256(abi.encodePacked("mintTokens", nonce));
        require(!isNonceUsed[nonceHash], "Error: Nonce already used.");
        isNonceUsed[nonceHash] = true;

        BridgeMintableToken ercToken = BridgeMintableToken(token);
        ercToken.mint(receiver, amount);
        emit TokensMinted(token, msg.sender, amount);
    }
    //TODO work towards unifying burnTokens into xchaintransfer function
    function burnTokens(
        address bridgeToken,
        uint256 amount
    )
    public
    isAmountGreaterThanZero(amount)
    isBridgeNotFrozen
    {
        require(isCreatedByTheBridge[bridgeToken], "Error: Token is not created by the bridge.");

        BridgeMintableToken token = BridgeMintableToken(bridgeToken);
        token.burnFrom(msg.sender, amount);
        emit TokensBurned(address(token), msg.sender, amount);
    }

    // Function to burn tokens to selected network bridge
    function crossChainTransfer(
        address bridgeToken,
        uint256 amount,
        uint256 networkId
    )
    public
    isBridgeNotFrozen
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

    // Function used to set mapping for token addresses
    function setOriginalAssetToBridgeToken(
        address [] memory mainBridgeTokenAddresses,
        address [] memory sideBridgeTokenAddresses
    )
    public
    onlyMaintainer
    {
        for(uint i = 0; i < mainBridgeTokenAddresses.length; i++){
            require(mainBridgeTokenAddresses[i] != address(0) && sideBridgeTokenAddresses[i] != address(0));
            originalAssetToBridgeToken[mainBridgeTokenAddresses[i]] = sideBridgeTokenAddresses[i];
        }
    }

    // Function to change maintainerWorkInProgress variable/flag
    // Affects modifier
    function setMaintainerWorkInProgress(
        bool isMaintainerWorkInProgress
    )
    public
    onlyMaintainer
    {
        maintainerWorkInProgress = isMaintainerWorkInProgress;
        emit MaintainerWorkInProgress(isMaintainerWorkInProgress);
    }
}