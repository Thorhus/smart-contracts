//"SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./BridgeMintableToken.sol";
import "./ChainportMiddleware.sol";
import "./interfaces/IValidator.sol";


contract ChainportSideBridge is Initializable, ChainportMiddleware {

    IValidator public signatureValidator;

    // Global state variables
    // Mapping for new minted token addresses - outdated/unused
    mapping(address => address) public erc20ToBep20Address;
    // Mapping for tracking nonce per function - outdated/unused
    mapping(string => uint256) public functionNameToNonce;
    // Mapping for checking if token is created by the bridge
    mapping(address => bool) public isCreatedByTheBridge;
    // Bool for bridge frozen status
    bool public isFrozen;
    // Network activity state mapping
    mapping(uint256 => bool) public isNetworkActive;
    // Nonce check mapping
    mapping(bytes32 => bool) public isNonceUsed;
    // New mapping replacement for old erc20ToBep20Address
    mapping(address => address) public originalAssetToBridgeToken;
    // Security variable used for maintainer one time actions check used for upgrading
    bool public maintainerWorkInProgress;
    // Mapping for freezing the assets
    mapping(address => bool) public isAssetFrozen;
    // Mapping for freezing specific path: token -> functionName -> isPausedOrNot
    mapping(address => mapping(string => bool)) public isPathPaused;
    // Reversed mapping of originalAssetToBridgeToken
    mapping(address => address) public bridgeTokenToOriginalAsset;
    // Mapping for token minting thresholds
    mapping(address => uint256) public bridgeTokenToMintingThreshold;
    // Mapping for token minting threshold awareness
    mapping(address => bool) public bridgeTokenToThresholdAwareness;

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

    // Function to freeze the bridge
    function freezeBridge()
    public
    onlyMaintainer
    {
        isFrozen = true;
        emit BridgeFreezed(true);
    }

    // Function to unfreeze the bridge
    function unfreezeBridge()
    public
    onlyChainportCongress
    {
        isFrozen = false;
        emit BridgeFreezed(false);
    }

    // Function to mint new token
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
        // Require that token has not been minted already
        require(originalAssetToBridgeToken[originalTokenAddress] == address(0), "Error: Token already exists.");
        // Create new token
        BridgeMintableToken newToken = new BridgeMintableToken(tokenName, tokenSymbol, decimals);
        // Assign mapping values
        originalAssetToBridgeToken[originalTokenAddress] = address(newToken);
        bridgeTokenToOriginalAsset[address(newToken)] = originalTokenAddress;
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
        //TODO: Check supply before minting to assure the matching and disable additional minting
        if(bridgeTokenToThresholdAwareness[token]) {
            require(
                amount < bridgeTokenToMintingThreshold[token],
                "Error: Amount must be lower than the minting threshold."
            );
        }
        // Check if nonce is already used
        bytes32 nonceHash = keccak256(abi.encodePacked("mintTokens", nonce));
        require(!isNonceUsed[nonceHash], "Error: Nonce already used.");
        isNonceUsed[nonceHash] = true;
        // Mint tokens to receiver
        BridgeMintableToken ercToken = BridgeMintableToken(token);
        ercToken.mint(receiver, amount);
        emit TokensMinted(token, msg.sender, amount);
    }

    //TODO work towards unifying burnTokens into xchaintransfer function
    //TODO check if function can be removed
    // Old version burn tokens function
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
        // Require that network id is active
        require(isNetworkActive[networkId], "Error: Network with this id is not supported.");
        // Require that token is created by the bridge
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

    // Function to change maintainerWorkInProgress variable/flag - affects modifier
    function setMaintainerWorkInProgress(
        bool isMaintainerWorkInProgress
    )
    public
    onlyMaintainer
    {
        maintainerWorkInProgress = isMaintainerWorkInProgress;
        emit MaintainerWorkInProgress(isMaintainerWorkInProgress);
    }

    // Function to set single asset freeze state by congress
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
        for(uint16 i; i < tokenAddresses.length; i++){
            isAssetFrozen[tokenAddresses[i]] = true;
            emit AssetFrozen(tokenAddresses[i], true);
        }
    }

    // Function to set path pause state by maintainer
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

    // Function to set bridgeTokenToOriginalAsset
    function setBridgeTokenToOriginalAsset(
        address [] calldata bridgeTokens,
        address [] calldata originalAssets
    )
    external
    onlyMaintainer
    {
        for(uint16 i; i < bridgeTokens.length; i++) {
            require(
                bridgeTokens[i] != address(0) && originalAssets[i] != address(0),
                "Error: Addresses are malformed."
            );
            bridgeTokenToOriginalAsset[bridgeTokens[i]] = originalAssets[i];
        }
    }

    // Function to set minting thresholds for tokens
    function setMintingThresholds(
        address [] calldata originalAssets,
        uint256 [] calldata thresholds
    )
    external
    onlyChainportCongress
    {
        for(uint16 i; i < originalAssets.length; i++) {
            require(
                originalAssets[i] != address(0),
                "Error: Asset address is malformed."
            );
            require(
                thresholds[i] != 0,
                "Error: Cannot set zero value as threshold."
            );
            bridgeTokenToMintingThreshold[originalAssetToBridgeToken[originalAssets[i]]] = thresholds[i];
        }
    }

    // Function to set threshold awareness for tokens
    function setBridgeTokenToThresholdAwareness(
        address [] calldata bridgeTokens,
        bool [] calldata thresholdsAwareness
    )
    external
    onlyChainportCongress
    {
        for(uint16 i; i < bridgeTokens.length; i++) {
            require(bridgeTokens[i] != address(0));
            bridgeTokenToThresholdAwareness[bridgeTokens[i]] = thresholdsAwareness[i];
        }
    }
}
