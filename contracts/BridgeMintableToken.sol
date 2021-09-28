//"SPDX-License-Identifier: UNLICENSED"
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";

/**
 * BridgeMintableToken contract.
 * @author Nikola Madjarevic
 * Date created: 21.4.21.
 * Github: madjarevicn
 */
contract BridgeMintableToken is ERC20Burnable {

    address public sideBridgeContract;
    bool public isMintingFrozen;

    event Mint(address indexed to, uint256 amount);

    modifier onlySideBridgeContract {
        require(
            msg.sender == sideBridgeContract,
            "Error: Only Bridge contract can mint new tokens."
        );
        _;
    }

    constructor(
        string memory tokenName_,
        string memory tokenSymbol_,
        uint8 decimals_
    )
    public
    ERC20(tokenName_, tokenSymbol_)
    {
        _setupDecimals(decimals_);
        sideBridgeContract = msg.sender;
    }

    function mint(
        address _to,
        uint256 _amount
    )
    external
    onlySideBridgeContract
    {
        require(
            !isMintingFrozen,
            "Error: Minting action is currently frozen."
        );

        _mint(_to, _amount);
        emit Mint(_to, _amount);
    }

    // Function for setting new bridge proxy contract address
    function setSideBridgeContract(
        address _sideBridgeContract
    )
    external
    onlySideBridgeContract
    {
        require(_sideBridgeContract != address(0));
        sideBridgeContract = _sideBridgeContract;
    }

    // Function to freeze minting for token
    function setMintingFreezeState(
        bool _isMintingFrozen
    )
    external
    onlySideBridgeContract
    {
        isMintingFrozen = _isMintingFrozen;
    }
}
