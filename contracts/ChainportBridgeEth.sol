//"SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./libraries/SafeMath.sol";
import "./ChainportUpgradables.sol";
import "./interfaces/IValidator.sol";

contract ChainportBridgeEth is ChainportUpgradables {

    //TODO: NOMENCLATURE ON ALL CONTRACTS

    using SafeMath for uint;

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
    uint256 public timeLockLength;


    // Events
    event TokensUnfreezed(address tokenAddress, address issuer, uint amount);
    event TokensFreezed(address tokenAddress, address issuer, uint amount);
    event CreatedPendingWithdrawal(address token, address beneficiary, uint amount, uint unlockingTime);

    event WithdrawalApproved(address token, address beneficiary, uint amount);
    event WithdrawalRejected(address token, address beneficiary, uint amount);

    event TimeLockLengthChanged(uint newTimeLockLength);
    event AssetProtectionChanged(address asset, bool isProtected);
    event SafetyThresholdChanged(uint newSafetyThreshold);


    modifier isNotFrozen {
        require(isFrozen == false, "Error: All Bridge actions are currently frozen.");
        _;
    }

    modifier onlyIfAmountGreaterThanZero(uint amount) {
        require(amount > 0, "Amount is not greater than zero.");
        _;
    }

    // Initialization function
    function initialize(
        address _maintainersRegistryAddress,
        address _chainportCongress,
        address _signatureValidator,
        uint256 _timeLockLength,
        uint256 _safetyThreshold
    )
    public
    initializer
    {
        require(_safetyThreshold > 0 && _safetyThreshold < 100, "Error: % is not valid.");

        setCongressAndMaintainers(_chainportCongress, _maintainersRegistryAddress);
        signatureValidator = IValidator(_signatureValidator);
        timeLockLength = _timeLockLength; //todo: freeze length
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

    // Function to mark specific asset as protected
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

    // Function to set timelock
    function setTimeLockLength(
        uint length
    )
    public
    onlyChainportCongress
    {
        timeLockLength = length;
        emit TimeLockLengthChanged(length);
    }


    // Function to set minimal value that is considered important by quantity
    function setThreshold(
        uint _safetyThreshold
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
        bool response = ercToken.transferFrom(address(msg.sender), address(this), amount);
        require(response, "Transfer did not go through.");

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
        bool response = IERC20(token).transfer(beneficiary, amount);
        require(response, "Transfer did not go through.");

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

                bool response = IERC20(token).transfer(p.beneficiary, p.amount);
                require(response, "Transfer did not go through.");

                emit TokensUnfreezed(token, p.beneficiary, p.amount);
                // Clear up the state and remove pending flag
                delete tokenToPendingWithdrawal[token];
                isTokenHavingPendingWithdrawal[token] = false;
            }
        } else {
            revert("Invalid function call");
        }
    }

    // Function to release tokens
    function releaseTokens(
        bytes memory signature,
        address token,
        uint amount,
        uint nonce
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
        require(isMessageValid == true, "Error: Signature is not valid.");


        if(isAboveThreshold(token, amount) && isAssetProtected[token] == true) {
            PendingWithdrawal memory p = PendingWithdrawal({
                amount: amount,
                beneficiary: beneficiary,
                unlockingTime: now.add(timeLockLength)
            });

            tokenToPendingWithdrawal[token] = p;
            isTokenHavingPendingWithdrawal[token] = true;

            // Fire an event
            emit CreatedPendingWithdrawal(token, beneficiary, amount, p.unlockingTime);
        } else {
            bool response = IERC20(token).transfer(beneficiary, amount);
            require(response, "Transfer did not go through.");

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
        // Transfer funds to user
        bool response = IERC20(token).transfer(p.beneficiary, p.amount);
        require(response, "Transfer did not go through.");
        // Emit events
        emit TokensUnfreezed(token, p.beneficiary, p.amount);
        emit WithdrawalApproved(token, p.beneficiary, p.amount);

        // Clear up the state and remove pending flag
        delete tokenToPendingWithdrawal[token];
        isTokenHavingPendingWithdrawal[token] = false;
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
    function isAboveThreshold(address token, uint amount) public view returns (bool) {
        return amount >= getTokenBalance(token).mul(safetyThreshold).div(100);
    }

    // Get contract balance of specific token
    function getTokenBalance(address token) internal view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
