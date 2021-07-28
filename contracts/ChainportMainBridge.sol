//"SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./ChainportMiddleware.sol";
import "./interfaces/IValidator.sol";

contract ChainportMainBridge is Initializable, ChainportMiddleware {

    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IValidator public signatureValidator;

    struct PendingWithdrawal {
        uint256 amount;
        address beneficiary;
        uint256 unlockingTime;
    }

    // Mapping if bridge is Frozen
    bool public isFrozen;
    // Mapping function name to maintainer nonce
    mapping(string => uint256) public functionNameToNonce;
    // Mapping the pending withdrawal which frozen temporarily asset circulation
    mapping(address => PendingWithdrawal) public tokenToPendingWithdrawal;
    // Mapping per token to check if there's any pending withdrawal attempt
    mapping(address => bool) public isTokenHavingPendingWithdrawal;
    // Mapping for marking the assets
    mapping(address => bool) public isAssetProtected;
    // Check if signature is being used
    mapping(bytes => bool) public isSignatureUsed;
    // % of the tokens, must be whole number, no decimals pegging
    uint256 public safetyThreshold;
    // Length of the timeLock
    uint256 public freezeLength;
    // Mapping for freezing the assets
    mapping(address => bool) public isAssetFrozen;

    // Network activity state mapping
    mapping(uint256 => bool) public isNetworkActive;

    // Nonce mapping
    mapping(bytes32 => bool) public isNonceUsed;

    // Mapping for freezing specific path: token -> functionName -> isPausedOrNot
    mapping(address => mapping(string => bool)) public isPathPaused;

    // Events
    event TokensClaimed(address tokenAddress, address issuer, uint256 amount);

    event CreatedPendingWithdrawal(address token, address beneficiary, uint256 amount, uint256 unlockingTime);

    event WithdrawalApproved(address token, address beneficiary, uint256 amount);
    event WithdrawalRejected(address token, address beneficiary, uint256 amount);

    event TimeLockLengthChanged(uint256 newTimeLockLength);
    event AssetProtected(address asset, bool isProtected);
    event SafetyThresholdChanged(uint256 newSafetyThreshold);

    event AssetFrozen(address asset, bool isAssetFrozen);

    event NetworkActivated(uint256 networkId);
    event NetworkDeactivated(uint256 networkId);

    event TokensDeposited(address tokenAddress, address issuer, uint256 amount, uint256 networkId);

    event pathPauseStateChanged(address tokenAddress, string functionName, bool isPaused);

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

    // Initialization function
    function initialize(
        address _maintainersRegistryAddress,
        address _chainportCongress,
        address _signatureValidator,
        uint256 _freezeLength,
        uint256 _safetyThreshold
    )
    public
    initializer
    {
        require(_safetyThreshold > 0 && _safetyThreshold < 100, "Error: % is not valid.");

        setCongressAndMaintainers(_chainportCongress, _maintainersRegistryAddress);
        signatureValidator = IValidator(_signatureValidator);
        freezeLength = _freezeLength;
        safetyThreshold = _safetyThreshold;
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

    function freezeAssetByMaintainer(
        address tokenAddress
    )
    public
    onlyMaintainer
    {
        isAssetFrozen[tokenAddress] = true;
        emit AssetFrozen(tokenAddress, true);
    }

    function setAssetProtection(
        address tokenAddress,
        bool _isProtected
    )
    public
    onlyChainportCongress
    {
        isAssetProtected[tokenAddress] = _isProtected;
        emit AssetProtected(tokenAddress, _isProtected);
    }

    function protectAssetByMaintainer(
        address tokenAddress
    )
    public
    onlyMaintainer
    {
        isAssetProtected[tokenAddress] = true;
        emit AssetProtected(tokenAddress, true);
    }

    // Function to set timelock
    function setTimeLockLength(
        uint256 length
    )
    public
    onlyChainportCongress
    {
        freezeLength = length;
        emit TimeLockLengthChanged(length);
    }

    // Function to set minimal value that is considered important by quantity
    function setThreshold(
        uint256 _safetyThreshold
    )
    public
    onlyChainportCongress
    {
        // This is representing % of every asset on the contract
        // Example: 32% is safety threshold
        require(_safetyThreshold > 0 && _safetyThreshold < 100, "Error: % is not valid.");

        safetyThreshold = _safetyThreshold;
        emit SafetyThresholdChanged(_safetyThreshold);
    }

    function releaseTokensByMaintainer(
        bytes memory signature,
        address token,
        uint256 amount,
        address beneficiary,
        uint256 nonce
    )
    public
    onlyMaintainer
    isBridgeNotFrozen
    isAmountGreaterThanZero(amount)
    isAssetNotFrozen(token)
    isPathNotPaused(token, "releaseTokensByMaintainer")
    {
        require(isTokenHavingPendingWithdrawal[token] == false, "Error: Token is currently having pending withdrawal.");

        require(isSignatureUsed[signature] == false, "Error: Already used signature.");
        isSignatureUsed[signature] = true;

        bytes32 nonceHash = keccak256(abi.encodePacked("releaseTokensByMaintainer", nonce));
        require(!isNonceUsed[nonceHash], "Error: Nonce already used.");
        isNonceUsed[nonceHash] = true;

        bool isMessageValid = signatureValidator.verifyWithdraw(signature, nonce, beneficiary, amount, token);
        require(isMessageValid == true, "Error: Signature is not valid.");

        IERC20(token).safeTransfer(beneficiary, amount);

        emit TokensClaimed(token, beneficiary, amount);
    }

    function releaseTokensTimelockPassed(
        bytes memory signature,
        address token,
        uint256 amount,
        uint256 nonce
    )
    public
    isBridgeNotFrozen
    isAmountGreaterThanZero(amount)
    isAssetNotFrozen(token)
    isPathNotPaused(token, "releaseTokens")
    {
        require(isSignatureUsed[signature] == false, "Error: Signature already used");
        isSignatureUsed[signature] = true;

        bytes32 nonceHash = keccak256(abi.encodePacked("releaseTokens", nonce));
        require(!isNonceUsed[nonceHash], "Error: Nonce already used.");
        isNonceUsed[nonceHash] = true;

        // Check if freeze time has passed and same user is calling again
        if(isTokenHavingPendingWithdrawal[token] == true) {
            PendingWithdrawal memory p = tokenToPendingWithdrawal[token];
            if(p.amount == amount && p.beneficiary == msg.sender && p.unlockingTime <= block.timestamp) {
                // Verify the signature user is submitting
                bool isMessageValid = signatureValidator.verifyWithdraw(signature, nonce, p.beneficiary, amount, token);
                require(isMessageValid == true, "Error: Signature is not valid.");

                // Clear up the state and remove pending flag
                delete tokenToPendingWithdrawal[token];
                delete isTokenHavingPendingWithdrawal[token];

                IERC20(token).safeTransfer(p.beneficiary, p.amount);

                emit TokensClaimed(token, p.beneficiary, p.amount);
                emit WithdrawalApproved(token, p.beneficiary, p.amount);
            }
        } else {
            revert("Invalid function call");
        }
    }

    // Function to release tokens
    function releaseTokens(
        bytes memory signature,
        address token,
        uint256 amount,
        uint256 nonce
    )
    public
    isBridgeNotFrozen
    isAmountGreaterThanZero(amount)
    isAssetNotFrozen(token)
    isPathNotPaused(token, "releaseTokens")
    {
        require(isTokenHavingPendingWithdrawal[token] == false, "Error: Token is currently having pending withdrawal.");

        require(isSignatureUsed[signature] == false, "Error: Signature already used");
        isSignatureUsed[signature] = true;

        bytes32 nonceHash = keccak256(abi.encodePacked("releaseTokens", nonce));
        require(!isNonceUsed[nonceHash], "Error: Nonce already used.");


        // msg.sender is beneficiary address
        address beneficiary = msg.sender;
        // Verify the signature user is submitting
        bool isMessageValid = signatureValidator.verifyWithdraw(signature, nonce, beneficiary, amount, token);
        // Requiring that signature is valid
        require(isMessageValid == true, "Error: Signature is not valid.");


        if(isAboveThreshold(token, amount) && isAssetProtected[token] == true) {

            PendingWithdrawal memory p = PendingWithdrawal({
                amount: amount,
                beneficiary: beneficiary,
                unlockingTime: now.add(freezeLength)
            });

            tokenToPendingWithdrawal[token] = p;
            isTokenHavingPendingWithdrawal[token] = true;

            // Fire an event
            emit CreatedPendingWithdrawal(token, beneficiary, amount, p.unlockingTime);
        } else {
            isNonceUsed[nonceHash] = true;

            IERC20(token).safeTransfer(beneficiary, amount);

            emit TokensClaimed(token, beneficiary, amount);
        }
    }

    // Function for congress to approve withdrawal and transfer funds
    function approveWithdrawalAndTransferFunds(
        address token
    )
    public
    onlyChainportCongress
    isBridgeNotFrozen
    {
        require(isTokenHavingPendingWithdrawal[token] == true);
        // Get current pending withdrawal attempt
        PendingWithdrawal memory p = tokenToPendingWithdrawal[token];
        // Clear up the state and remove pending flag
        delete tokenToPendingWithdrawal[token];
        delete isTokenHavingPendingWithdrawal[token];

        // Transfer funds to user
        IERC20(token).safeTransfer(p.beneficiary, p.amount);

        // Emit events
        emit TokensClaimed(token, p.beneficiary, p.amount);
        emit WithdrawalApproved(token, p.beneficiary, p.amount);
    }

    // Function to reject withdrawal from congress
    function rejectWithdrawal(
        address token
    )
    public
    onlyChainportCongress
    isBridgeNotFrozen
    {
        require(isTokenHavingPendingWithdrawal[token] == true);
        // Get current pending withdrawal attempt
        PendingWithdrawal memory p = tokenToPendingWithdrawal[token];
        emit WithdrawalRejected(token, p.beneficiary, p.amount);
        // Clear up the state and remove pending flag
        delete tokenToPendingWithdrawal[token];
        delete isTokenHavingPendingWithdrawal[token];
    }

    // Function to check if amount is above threshold
    function isAboveThreshold(address token, uint256 amount) public view returns (bool) {
        return amount >= getTokenBalance(token).mul(safetyThreshold).div(100);
    }

    // Get contract balance of specific token
    function getTokenBalance(address token) internal view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    // Function to deposit tokens to bridge on specified network
    function depositTokens(
        address token,
        uint256 amount,
        uint256 networkId
    )
    public
    isBridgeNotFrozen
    isAmountGreaterThanZero(amount)
    isAssetNotFrozen(token)
    isPathNotPaused(token, "depositTokens")
    {
        // Require that network is supported/activated
        require(isNetworkActive[networkId], "Error: Network with this id is not supported.");

        // Transfer funds from user to bridge
        IERC20(token).safeTransferFrom(address(msg.sender), address(this), amount);

        // Emit event
        emit TokensDeposited(token, msg.sender, amount, networkId);
    }

    // Function to activate already added supported network
    function activateNetwork(
        uint256 networkId
    )
    public
    onlyMaintainer
    {
        isNetworkActive[networkId] = true;
        emit NetworkActivated(networkId);
    }

    // Function to deactivate specified added network
    function deactivateNetwork(
        uint256 networkId
    )
    public
    onlyChainportCongress
    {
        isNetworkActive[networkId] = false;
        emit NetworkDeactivated(networkId);
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
        emit pathPauseStateChanged(token, functionName, isPaused);
    }
}
