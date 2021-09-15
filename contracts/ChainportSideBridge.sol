//"SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./BridgeMintableToken.sol";
import "./ChainportMiddleware.sol";
import "./interfaces/IValidator.sol";
import "./interfaces/UniswapV2Interface.sol";

contract ChainportSideBridge is Initializable, ChainportMiddleware {

    IValidator public signatureValidator;

    // Previous version unused mappings
    mapping(address => address) public erc20ToBep20Address;
    mapping(string => uint256) public functionNameToNonce;

    // Boolean mapping for token bridge creation documentation
    mapping(address => bool) public isCreatedByTheBridge;
    // Boolean for bridge freeze state
    bool public isFrozen;
    // Network activity state mapping
    mapping(uint256 => bool) public isNetworkActive;
    // Nonce check mapping
    mapping(bytes32 => bool) public isNonceUsed;
    // New mapping replacement for erc20ToBep20Address
    mapping(address => address) public originalAssetToBridgeToken;
    // Security variable used for maintainer one time actions check used for upgrading
    bool public maintainerWorkInProgress;
    // Mapping for freezing the assets
    mapping(address => bool) public isAssetFrozen;
    // Mapping for freezing specific path: token -> functionName -> isPausedOrNot
    mapping(address => mapping(string => bool)) public isPathPaused;
    // Exchange router address
    address public router;
    // Stable coin address for router
    address public stableCoin;
    // Safety threshold for minting (usd)
    uint8 public stableCoinDecimals;
    // Minting usd value threshold
    uint256 public usdThreshold;
    // Reversed mapping of originalAssetToBridgeToken
    mapping(address => address) public bridgeTokenToOrginalAsset;
    // Mapping for main bridge balances
    mapping(address => uint256) public originalAssetToBalance;
    // Percentage threshold for token minting
    uint8 public percentThreshold;

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

    // Function to mint new token by maintainer
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
        bridgeTokenToOrginalAsset[address(newToken)] = originalTokenAddress;
        isCreatedByTheBridge[address(newToken)] = true;
        emit TokenCreated(address(newToken), originalTokenAddress, tokenName, tokenSymbol, decimals);
    }

    // Function to mint tokens by maintainer
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
        bytes32 nonceHash = keccak256(abi.encodePacked("mintTokens", nonce));
        require(!isNonceUsed[nonceHash], "Error: Nonce already used.");
        isNonceUsed[nonceHash] = true;

        BridgeMintableToken ercToken = BridgeMintableToken(token);
        ercToken.mint(receiver, amount);
        emit TokensMinted(token, msg.sender, amount);
    }

    // TODO work towards unifying burnTokens into xchaintransfer function
    // TODO: Check if function can be removed
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

    // Function to change maintainerWorkInProgress flag
    // TODO: Check if can be removed along with modifiers
    function setMaintainerWorkInProgress(
        bool isMaintainerWorkInProgress
    )
    public
    onlyMaintainer
    {
        maintainerWorkInProgress = isMaintainerWorkInProgress;
        emit MaintainerWorkInProgress(isMaintainerWorkInProgress);
    }

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

    function setExchange(address _router) external onlyChainportCongress {
        require(_router != address(0), "Error: Address is malformed.");
        router = _router;
    }

    function setStableCoin(address _stableCoin) external onlyChainportCongress {
        require(_stableCoin != address(0), "Error: Address is malformed.");
        stableCoin = _stableCoin;
        stableCoinDecimals = ERC20(stableCoin).decimals();
    }

    function setUsdThreshold(uint256 _usdThreshold) external onlyChainportCongress {
        usdThreshold = _usdThreshold;
    }

    function setPercentThreshold(uint8 _percentageThreshold) external onlyChainportCongress {
        percentThreshold = _percentageThreshold;
    }

    function getTokenValueInUsd(uint amount, address token) internal view returns(uint[] memory amounts) {
        address [] memory pair;
        pair[0] = token;
        pair[1] = stableCoin;
        return UniswapV2Interface(router).getAmountsOut(amount, pair);
    }

    function setOriginalTokenBalancesOnMainBridge(
        address [] calldata originalAssets,
        uint256 [] calldata balances
    )
    external
    onlyChainportCongress
    {
        for(uint16 i; i < originalAssets.length; i++) {
            originalAssetToBalance[originalAssets[i]] = balances[i];
        }
    }

    function backendAddNewTokenBalance(
        address token,
        uint256 balance
    )
    external
    onlyMaintainer // TODO: Consider adding another authority entity
    {
        originalAssetToBalance[token] = balance;
    }

    function setBridgeTokenToOriginalAsset(
        address [] calldata bridgeTokens,
        address [] calldata originalAssets
    )
    external
    onlyChainportCongress
    {
        for(uint16 i; i < bridgeTokens.length; i++) {
            require(
                bridgeTokens[i] != address(0) && originalAssets[i] != address(0),
                "Error: Malformed addresses present."
            );
            bridgeTokenToOrginalAsset[bridgeTokens[i]] = originalAssets[i];
        }
    }

    function getBridgeTokenThresholdFromPercent(address token) internal view returns(uint256){
        return originalAssetToBalance[bridgeTokenToOrginalAsset[token]].mul(percentThreshold).div(100);
    }
}
