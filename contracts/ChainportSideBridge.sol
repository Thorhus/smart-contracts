//"SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./BridgeMintableToken.sol";
import "./ChainportMiddleware.sol";
import "./interfaces/IValidator.sol";
import "./interfaces/IChainportExchange.sol";

contract ChainportSideBridge is Initializable, ChainportMiddleware {

    using SafeMath for uint;

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
    // Address of the chainport exchange
    address public chainportExchange;
    // Minting usd value threshold
    uint256 public mintingThresholdUsd;
    // Signature usage mapping
    mapping(bytes => bool) isSignatureUsed;
    // Mapping for assets being frozen on single chain
    mapping(uint256 => mapping(address => bool)) tokenFreezeStatePerNetwork;
    // Official id of the deployment network
    uint256 officialNetworkId;

        //TODO: when there is a mint request for a specific token, have a mapping token-->startSampleAt, if more than SAMPLE_SAFEGUARD_TIME_MIN (configurable by congress, default to 3), override value, set mint value in usd to mapping token-->totalMintedLastSafeGuardTimeFrame
        //TODO: else, when getting the mint amount usd value, add to token-->totalMintedLastSafeGuardTimeFrame
        //TODO:      if totalMintedLastSafeGuardTimeFrame > mintUSDValueThresholdPerSafeGuardTimeframePerToken, pause the mint path for that token


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
    event Log(string _err);
    event LogBytes(bytes _err);

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

    modifier isTokenNotFrozenPerNetwork(
        uint256 networkId,
        address token
    )
    {
        require(
            !tokenFreezeStatePerNetwork[networkId][token],
            "Error: Token actions are frozen on selected network."
        );
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
    maintainerWorkNotInProgress // TODO: Check for removal
    {
        // Require that token wasn't already minted
        require(originalAssetToBridgeToken[originalTokenAddress] == address(0), "Error: Token already exists.");
        // Mint new token
        BridgeMintableToken newToken = new BridgeMintableToken(tokenName, tokenSymbol, decimals);
        // Configure mappings
        originalAssetToBridgeToken[originalTokenAddress] = address(newToken);
        isCreatedByTheBridge[address(newToken)] = true;
        emit TokenCreated(address(newToken), originalTokenAddress, tokenName, tokenSymbol, decimals);
    }

    // Function to mint tokens by maintainer
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
    maintainerWorkNotInProgress // TODO: Check for removal
    isPathNotPaused(token, "mintTokens")
    //TODO: add check for isTokenNotFrozenPerNetwork
    {
        // Require that token was created by the bridge
        require(isCreatedByTheBridge[token], "Error: Token was not created by the bridge.");
        // Check the nonce
        bytes32 nonceHash = keccak256(abi.encodePacked("mintTokens", nonce));
        require(!isNonceUsed[nonceHash], "Error: Nonce already used.");
        isNonceUsed[nonceHash] = true;
        // Require that signature has not been already used
        require(!isSignatureUsed[signature], "Error: Signature already used.");
        isSignatureUsed[signature] = true;
        // Require that the signature is valid
        require(
            signatureValidator.verifyWithdraw(signature, nonce, receiver, amount, token, officialNetworkId),
            "Error: Invalid signature."
        );
        // Try to gather token usd value
        try IChainportExchange(chainportExchange).getTokenValueInUsd(amount, token) returns (uint[] memory amounts) {
            uint256 amountInUsd = amounts[1];
            require(
                amountInUsd < mintingThresholdUsd,
                "Error: Token amount is too big."
            );
        } catch Error(string memory _err) { emit Log(_err); }
        catch (bytes memory _err) { emit LogBytes(_err); }

        // Mint tokens to user
        BridgeMintableToken ercToken = BridgeMintableToken(token);
        ercToken.mint(receiver, amount);

        emit TokensMinted(token, msg.sender, amount);
    }

    // Old function for token burning
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
    isTokenNotFrozenPerNetwork(networkId, bridgeToken)
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
    // TODO: Check if can be removed along with modifier
    function setMaintainerWorkInProgress(
        bool isMaintainerWorkInProgress
    )
    public
    onlyMaintainer
    {
        maintainerWorkInProgress = isMaintainerWorkInProgress;
        emit MaintainerWorkInProgress(isMaintainerWorkInProgress);
    }

    // Function to freeze or unfreeze asset by congress
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

    // Function to set the ChainportExchange contract which will serve for token value conversions
    function setChainportExchange(address _chainportExchange) external onlyChainportCongress {
        require(_chainportExchange != address(0), "Error: Address is malformed.");
        chainportExchange = _chainportExchange;
    }

    // Function to set universal threshold for tokens
    function setMintingThresholdUsd(uint256 _mintingThresholdUsd) external onlyChainportCongress {
        mintingThresholdUsd = _mintingThresholdUsd;
    }

    // Function to set the signature validator contract
    function setSignatureValidator(address _signatureValidator) external onlyChainportCongress {
        signatureValidator = IValidator(_signatureValidator);
    }

    //TODO: enable emergencyFreeze in the token contract itself, callable only by chainport side bridge
    //TODO: when maintainer calls this function below, trigger the emergencyFreeze on the token contract itself
    //TODO: the token contract should also have an unfreezeToken callable only by chainport congress
    // Function to freeze token per network by maintainer
    function freezeTokenForNetwork(uint256 networkId, address token) external onlyMaintainer {
        require(token != address(0), "Error: Token address malformed.");
        tokenFreezeStatePerNetwork[networkId][token] = true;
    }

    // Function to change token freeze state per network by congress
    function setTokenFreezeStatePerNetwork(uint256 networkId, address token, bool state) external onlyChainportCongress {
        require(token != address(0), "Error: Token address malformed.");
        tokenFreezeStatePerNetwork[networkId][token] = state;
    }

    // Function to set official network id
    function setOfficialNetworkId(uint256 networkId) external onlyChainportCongress {
        officialNetworkId = networkId;
    }
}
