//"SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./BridgeMintableToken.sol";
import "./ChainportMiddleware.sol";
import "./interfaces/IValidator.sol";
import "./interfaces/IAPIConsumer.sol";

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
    // Mapping for freezing the assets
    mapping(address => bool) public isAssetFrozen;
    // Mapping for freezing specific path: token -> functionName -> isPausedOrNot
    mapping(address => mapping(string => bool)) public isPathPaused;
    // API Consumer address
    address public APIConsumerAddress;
    // Mapping for reverse action of originalAssetToBridgeToken
    mapping(address => address) public bridgeTokenToOriginalAsset;
    // Mapping for token balances of original assets on main bridge
    mapping(address => uint256) public originalAssetLatestBalance;

    // Events
    event TokensMinted(address tokenAddress, address issuer, uint256 amount);
    event TokensBurned(address tokenAddress, address issuer, uint256 amount);
    event TokenCreated(address newTokenAddress, address ethTokenAddress, string tokenName, string tokenSymbol, uint8 decimals);
    event TokensTransferred(address bridgeTokenAddress, address issuer, uint256 amount, uint256 networkId);

    event NetworkActivated(uint256 networkId);
    event NetworkDeactivated(uint256 networkId);

    event MaintainerWorkInProgress(bool isMaintainerWorkInProgress);

    event AssetFrozen(address asset, bool isAssetFrozen);

    event PathPauseStateChanged(address tokenAddress, string functionName, bool isPaused);

    event BridgeFreezed(bool isFrozen);

    // Modifiers
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

    modifier isAssetNotFrozen(address asset) {
        require(!isAssetFrozen[asset], "Error: Asset is frozen.");
        _;
    }

    modifier isPathNotPaused(
        address token,
        string memory functionName
    )
    {
        require(!isPathPaused[token][functionName], "Error: Path is paused.");
        _;
    }

    // Set initial parameters
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
        emit BridgeFreezed(true);
    }

    function unfreezeBridge()
    public
    onlyChainportCongress
    {
        isFrozen = false;
        emit BridgeFreezed(false);
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
    isAssetNotFrozen(token)
    isAmountGreaterThanZero(amount)
    maintainerWorkNotInProgress
    isPathNotPaused(token, "mintTokens")
    {
        require(
            amount <= originalAssetLatestBalance[bridgeTokenToOriginalAsset[token]],
            "Error: Not enough funds on ChainportMainBridge."
        );

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
    isAssetNotFrozen(bridgeToken)
    isPathNotPaused(bridgeToken, "burnTokens")
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
    isAssetNotFrozen(bridgeToken)
    isAmountGreaterThanZero(amount)
    isPathNotPaused(bridgeToken, "crossChainTransfer")
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
    // TODO: Check if can be removed
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

    // Set specified token freeze state
    // TODO: Check if freeze asset function restrictions are well sorted
    function setAssetFreezeState(
        address tokenAddress,
        bool _isFrozen
    )
    public
    onlyChainportCongress
    {
        isAssetFrozen[tokenAddress] = _isFrozen;
        emit AssetFrozen(tokenAddress, _isFrozen);
    }

    // Function to freeze multiple assets by maintainer
    function freezeAssetsByMaintainer(
        address [] memory tokenAddresses
    )
    public
    onlyMaintainer
    {
        for(uint i = 0; i < tokenAddresses.length; i++){
            isAssetFrozen[tokenAddresses[i]] = true;
            emit AssetFrozen(tokenAddresses[i], true);
        }
    }

    // Function to pause specified path
    function setPathPauseState(
        address token,
        string memory functionName,
        bool isPaused
    )
    public
    onlyMaintainer
    {
        isPathPaused[token][functionName] = isPaused;
        emit PathPauseStateChanged(token, functionName, isPaused);
    }

    // Function to get the latest response from APIConsumer contract
    function getAPIConsumerLatestResponse()
    public
    view
    onlyMaintainer
    returns(bytes32)
    {
        // APIConsumer call through interface
        return IAPIConsumer(APIConsumerAddress).getLatestResult();
    }

    // Function to make request to get supply of specific token
    function makeGetMainBridgeTokenSupplyRequest(
        address bridgeToken
    )
    external
    onlyMaintainer
    {
        // Instantiate APIConsumer through interface and make request
        IAPIConsumer(APIConsumerAddress).getMainBridgeTokenSupply(bridgeTokenToOriginalAsset[bridgeToken]);
    }

    // Function to make a custom request through APIConsumer
    // Make sure that APIConsumer settings are compatible with the request
    function makeCustomRequest(
        string memory requestString,
        string memory pathString,
        string memory method
    )
    external
    onlyMaintainer
    {
        // Send custom request
        IAPIConsumer(APIConsumerAddress).makeCustomRequest(requestString, pathString, method);
    }

    // Get latest response from APIConsumer
    // Function made to overcome the delay between tx and response block
    function setOriginalAssetLatestBalance(
        address bridgeToken
    )
    external
    onlyMaintainer
    {
        // Retrieve latest request response
        originalAssetLatestBalance[bridgeTokenToOriginalAsset[bridgeToken]] = uint256(getAPIConsumerLatestResponse());
    }

    // Set APIConsumer contract address
    function setAPIConsumer(
        address _APIConsumerAddress
    )
    public
    onlyMaintainer
    {
        require(_APIConsumerAddress != address(0), "Error: Address is malformed.");
        APIConsumerAddress = _APIConsumerAddress;
    }

    // Set mapping bridgeToken -> originalAsset
    function setBridgeTokenToOriginalAsset(
        address [] calldata bridgeTokens,
        address [] calldata originalAssets
    )
    external
    onlyMaintainer
    {
        for(uint i = 0; i < bridgeTokens.length; i++){
            require(bridgeTokens[i] != address(0) && originalAssets[i] != address(0));
            bridgeTokenToOriginalAsset[bridgeTokens[i]] = originalAssets[i];
        }
    }

}
