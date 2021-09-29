//"SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./BridgeMintableToken.sol";
import "./ChainportMiddleware.sol";
import "./interfaces/IValidator.sol";

contract ChainportSideBridge is Initializable, ChainportMiddleware {

    IValidator public signatureValidator;
    // Previous version deprecated mappings
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
    // Deprecated security feature
    bool public maintainerWorkInProgress;
    // Mapping for freezing the assets
    mapping(address => bool) public isAssetFrozen;
    // Mapping for freezing specific path: token -> functionName -> isPausedOrNot
    mapping(address => mapping(string => bool)) public isPathPaused;
    // Signature usage mapping
    mapping(bytes => bool) isSignatureUsed;
    // Official id of the deployment network
    uint256 officialNetworkId;

    // Events
    event TokensMinted(
        address tokenAddress,
        address issuer,
        uint256 amount
    );
    event TokensBurned(
        address tokenAddress,
        address issuer,
        uint256 amount
    );
    event TokenCreated(
        address newTokenAddress,
        address ethTokenAddress,
        string tokenName,
        string tokenSymbol,
        uint8 decimals
    );
    event TokensTransferred(
        address bridgeTokenAddress,
        address issuer,
        uint256 amount,
        uint256 networkId
    );
    event PathPauseStateChanged(
        address tokenAddress,
        string functionName,
        bool isPaused
    );
    event NetworkActivityStateSet(uint256 networkId, bool state);
    event AssetFrozen(address asset, bool isAssetFrozen);
    event BridgeFrozen(bool isFrozen);
    event TokenMintingFreezeStateChanged(address token, bool state);

    // Modifiers
    modifier isBridgeNotFrozen {
        require(isFrozen == false, "Error: All Bridge actions are currently frozen.");
        _;
    }

    modifier isAmountGreaterThanZero(uint256 amount) {
        require(amount > 0, "Error: Amount is not greater than zero.");
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
    external
    onlyMaintainer
    {
        isFrozen = true;
        emit BridgeFrozen(true);
    }

    // Function to unfreeze the bridge
    // TODO: Check if it is better to set state instead of only unfreezing
    function unfreezeBridge()
    external
    onlyChainportCongress
    {
        isFrozen = false;
        emit BridgeFrozen(false);
    }

    // Function to create a new token by the bridge
    function mintNewToken(
        address originalTokenAddress,
        string memory tokenName,
        string memory tokenSymbol,
        uint8 decimals
    )
    public
    onlyMaintainer
    isBridgeNotFrozen
    {
        // Require that token wasn't already minted
        require(
            originalAssetToBridgeToken[originalTokenAddress] == address(0),
            "Error: Token already exists."
        );
        // Mint new token
        BridgeMintableToken newToken = new BridgeMintableToken(tokenName, tokenSymbol, decimals);
        // Configure mappings
        originalAssetToBridgeToken[originalTokenAddress] = address(newToken);
        isCreatedByTheBridge[address(newToken)] = true;
        emit TokenCreated(address(newToken), originalTokenAddress, tokenName, tokenSymbol, decimals);
    }

    // Function to mint tokens to user by maintainer
    function mintTokens(
        address token,
        address receiver,
        uint256 amount,
        uint256 nonce,
        bytes memory signature
    )
    public
    onlyMaintainer
    isBridgeNotFrozen
    isAssetNotFrozen(token)
    isAmountGreaterThanZero(amount)
    isPathNotPaused(token, "mintTokens")
    {
        // Require that token was created by the bridge
        require(isCreatedByTheBridge[token], "Error: Token was not created by the bridge.");
        // Check the nonce
        bytes32 nonceHash = keccak256(abi.encodePacked("mintTokens", nonce));
        require(!isNonceUsed[nonceHash], "Error: Nonce already used.");
        isNonceUsed[nonceHash] = true;
        // Require that signature has not been already used
        require(!isSignatureUsed[signature], "Error: Signature already used.");
        isSignatureUsed[signature] = true; //TODO: rename to isMintSignatureUsed
        // Require that the signature is valid
        require(
            signatureValidator.verifyMint(signature, nonce, receiver, amount, token, officialNetworkId),
            "Error: Invalid signature."
        );
        // Mint tokens to user
        BridgeMintableToken ercToken = BridgeMintableToken(token);
        ercToken.mint(receiver, amount);
        // Emit event
        emit TokensMinted(token, msg.sender, amount);
    }

    // Old function for token burning
    // TODO work towards unifying burnTokens into xchaintransfer function
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
        // Check if network is supported && token was minted by the bridge
        require(isNetworkActive[networkId], "Error: Network with this id is not supported.");
        require(isCreatedByTheBridge[bridgeToken], "Error: Token is not created by the bridge.");
        // Burn tokens from user
        BridgeMintableToken token = BridgeMintableToken(bridgeToken);
        token.burnFrom(msg.sender, amount);
        emit TokensTransferred(bridgeToken, msg.sender, amount, networkId);
    }

    // Function to activate selected network
    function activateNetwork(
        uint256 networkId
    )
    external
    onlyMaintainer
    {
        isNetworkActive[networkId] = true;
        emit NetworkActivityStateSet(networkId, true);
    }

    // Function to deactivate selected network
    function setNetworkActivityState(
        uint256 networkId,
        bool state
    )
    external
    onlyChainportCongress
    {
        isNetworkActive[networkId] = state;
        emit NetworkActivityStateSet(networkId, state);
    }

    // Function to freeze or unfreeze asset by congress
    function setAssetFreezeState(
        address tokenAddress,
        bool _isFrozen
    )
    external
    onlyChainportCongress
    {
        isAssetFrozen[tokenAddress] = _isFrozen;
        emit AssetFrozen(tokenAddress, _isFrozen);
    }

    // Function to freeze multiple assets by maintainer
    function freezeAssetsByMaintainer(
        address [] memory tokenAddresses
    )
    external
    onlyMaintainer
    {
        for(uint i = 0; i < tokenAddresses.length; i++){
            isAssetFrozen[tokenAddresses[i]] = true;
            emit AssetFrozen(tokenAddresses[i], true);
        }
    }

    // Function to pause specific path for token
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

    // Function to set the signature validator contract
    function setSignatureValidator(
        address _signatureValidator
    )
    external
    onlyChainportCongress
    {
        signatureValidator = IValidator(_signatureValidator);
    }

    // Function to perform emergency token freeze
    function emergencyTokenFreeze(
        address token
    )
    external
    onlyMaintainer
    {
        require(token != address(0), "Error: Token address malformed.");
        require(isCreatedByTheBridge[token], "Error: Bad token.");

        BridgeMintableToken(token).setMintingFreezeState(true);
        //TODO: also freeze transfers
    }

    // Function to freeze/unfreeze token minting by congress
    function setTokenMintingFreezeState(
        address token,
        bool state
    )
    external
    onlyChainportCongress
    {
        require(token != address(0), "Error: Token address malformed.");
        require(isCreatedByTheBridge[token], "Error: Token not created by the bridge.");

        BridgeMintableToken(token).setMintingFreezeState(state);
        //TODO: also unfreeze transfers
        emit TokenMintingFreezeStateChanged(token, state);
    }

    // Function to set official network id
    function setOfficialNetworkId(
        uint256 networkId
    )
    external
    onlyChainportCongress
    {
        require(networkId != 0, "Error: Bad network id.");
        officialNetworkId = networkId;
    }
}
