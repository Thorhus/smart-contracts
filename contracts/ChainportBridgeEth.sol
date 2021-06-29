//"SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./libraries/SafeMath.sol";
import "./ChainportMiddleware.sol";
import "./interfaces/IValidator.sol";

contract ChainportBridgeEth is Initializable, ChainportMiddleware {

    using SafeMath for uint256;

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

    // Network mappings
    mapping(uint8 => string) public networkNameById;
    mapping(uint8 => bool) public isNetworkActivated;

    // Number of networks used also for id
    uint8 public numberOfNetworks;

    // Events
    event TokensUnfreezed(address tokenAddress, address issuer, uint256 amount);
    event TokensFreezed(address tokenAddress, address issuer, uint256 amount);
    event CreatedPendingWithdrawal(address token, address beneficiary, uint256 amount, uint256 unlockingTime);

    event WithdrawalApproved(address token, address beneficiary, uint256 amount);
    event WithdrawalRejected(address token, address beneficiary, uint256 amount);

    event TimeLockLengthChanged(uint256 newTimeLockLength);
    event AssetProtectionChanged(address asset, bool isProtected);
    event SafetyThresholdChanged(uint256 newSafetyThreshold);

    event AssetFrozen(address asset, bool isAssetFrozen);

    event NetworkAdded(string networkName, uint8 networkId);
    event NetworkActivated(string networkName, uint8 networkId);
    event NetworkDeactivated(string networkName, uint8 networkId);

    event TokensDeposited(address tokenAddress, address issuer, uint256 amount, uint8 networkId);

    modifier isNotFrozen {
        require(isFrozen == false, "Error: All Bridge actions are currently frozen.");
        _;
    }

    modifier onlyIfAmountGreaterThanZero(uint256 amount) {
        require(amount > 0, "Amount is not greater than zero.");
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

    function freezeAsset(
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
        emit AssetProtectionChanged(tokenAddress, _isProtected);
    }

    function protectAssetByMaintainer(
        address tokenAddress
    )
    public
    onlyMaintainer
    {
        isAssetProtected[tokenAddress] = true;
        emit AssetProtectionChanged(tokenAddress, true);
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
        safetyThreshold = _safetyThreshold;
        emit SafetyThresholdChanged(_safetyThreshold);
    }

    function freezeToken(
        address token,
        uint256 amount
    )
    public
    isNotFrozen
    onlyIfAmountGreaterThanZero(amount)
    {
        IERC20 ercToken = IERC20(token);

        bool result = ercToken.transferFrom(address(msg.sender), address(this), amount);
        require(result, "Transfer did not go through.");

        emit TokensFreezed(token, msg.sender, amount);
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
    isNotFrozen
    onlyIfAmountGreaterThanZero(amount)
    {
        require(isTokenHavingPendingWithdrawal[token] == false, "Token is currently having pending withdrawal.");

        require(isSignatureUsed[signature] == false, "Already used signature.");
        isSignatureUsed[signature] = true;

        require(nonce == functionNameToNonce["mintTokens"] + 1);
        functionNameToNonce["mintTokens"] = nonce;

        bool isMessageValid = signatureValidator.verifyWithdraw(signature, token, amount, beneficiary, nonce);
        require(isMessageValid == true, "Error: Signature is not valid.");

        bool result = IERC20(token).transfer(beneficiary, amount);
        require(result, "Transfer did not go through.");

        emit TokensUnfreezed(token, beneficiary, amount);
    }

    function releaseTokensTimelockPassed(
        bytes memory signature,
        address token,
        uint256 amount,
        uint256 nonce
    )
    public
    isNotFrozen
    onlyIfAmountGreaterThanZero(amount)
    {
        require(isSignatureUsed[signature] == false, "Signature already used");
        isSignatureUsed[signature] = true;

        // Check if freeze time has passed and same user is calling again
        if(isTokenHavingPendingWithdrawal[token] == true) {
            PendingWithdrawal memory p = tokenToPendingWithdrawal[token];
            if(p.amount == amount && p.beneficiary == msg.sender && p.unlockingTime <= block.timestamp) {
                // Verify the signature user is submitting
                bool isMessageValid = signatureValidator.verifyWithdraw(signature, token, amount, p.beneficiary, nonce);
                require(isMessageValid == true, "Error: Signature is not valid.");

                // Clear up the state and remove pending flag
                delete tokenToPendingWithdrawal[token];
                isTokenHavingPendingWithdrawal[token] = false;

                bool result = IERC20(token).transfer(p.beneficiary, p.amount);
                require(result, "Transfer did not go through.");

                emit TokensUnfreezed(token, p.beneficiary, p.amount);
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
    isNotFrozen
    onlyIfAmountGreaterThanZero(amount)
    {
        require(isTokenHavingPendingWithdrawal[token] == false, "Token is currently having pending withdrawal.");

        require(isSignatureUsed[signature] == false, "Signature already used");
        isSignatureUsed[signature] = true;

        // msg.sender is beneficiary address
        address beneficiary = msg.sender;
        // Verify the signature user is submitting
        bool isMessageValid = signatureValidator.verifyWithdraw(signature, token, amount, beneficiary, nonce);
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
            bool result = IERC20(token).transfer(beneficiary, amount);
            require(result, "Transfer did not go through.");

            emit TokensUnfreezed(token, beneficiary, amount);
        }
    }

    // Function for congress to approve withdrawal and transfer funds
    function approveWithdrawalAndTransferFunds(
        address token
    )
    public
    onlyChainportCongress
    isNotFrozen
    {
        require(isTokenHavingPendingWithdrawal[token] == true);
        // Get current pending withdrawal attempt
        PendingWithdrawal memory p = tokenToPendingWithdrawal[token];
        // Clear up the state and remove pending flag
        delete tokenToPendingWithdrawal[token];
        isTokenHavingPendingWithdrawal[token] = false;

        // Transfer funds to user
        bool result = IERC20(token).transfer(p.beneficiary, p.amount);
        require(result, "Transfer did not go through.");
        // Emit events
        emit TokensUnfreezed(token, p.beneficiary, p.amount);
        emit WithdrawalApproved(token, p.beneficiary, p.amount);
    }

    // Function to reject withdrawal from congress
    function rejectWithdrawal(
        address token
    )
    public
    onlyChainportCongress
    isNotFrozen
    {
        require(isTokenHavingPendingWithdrawal[token] == true);
        // Get current pending withdrawal attempt
        PendingWithdrawal memory p = tokenToPendingWithdrawal[token];
        emit WithdrawalRejected(token, p.beneficiary, p.amount);
        // Clear up the state and remove pending flag
        delete tokenToPendingWithdrawal[token];
        isTokenHavingPendingWithdrawal[token] = false;
    }

    // Function to check if amount is above threshold
    function isAboveThreshold(address token, uint256 amount) public view returns (bool) {
        return amount >= getTokenBalance(token).mul(safetyThreshold).div(100);
    }

    // Get contract balance of specific token
    function getTokenBalance(address token) internal view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    // Function to deposit tokens to specified network's bridge
    function depositTokens(
        address token,
        uint256 amount,
        uint8 networkId
    )
    public
    isNotFrozen
    onlyIfAmountGreaterThanZero(amount)
    {
        IERC20 ercToken = IERC20(token);

        bool result = ercToken.transferFrom(address(msg.sender), address(this), amount);
        require(result, "Transfer did not go through.");

        emit TokensDeposited(token, msg.sender, amount, networkId);
    }

    // Function to add new supported network
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

    // Function to activate already added supported network
    function activateNetwork(
        uint8 networkId
    )
    public
    onlyMaintainer
    {
        isNetworkActivated[networkId] = true;
        emit NetworkActivated(networkNameById[networkId], networkId);
    }

    // Function to deactivate specified added network
    function deactivateNetwork(
        uint8 networkId
    )
    public
    onlyChainportCongress
    {
        isNetworkActivated[networkId] = false;
        emit NetworkDeactivated(networkNameById[networkId], networkId);
    }
}
