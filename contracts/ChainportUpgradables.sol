pragma solidity ^0.6.12;


import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./interfaces/IMaintainersRegistry.sol";


/**
 * ChainportUpgradables contract.
 * @author Nikola Madjarevic
 * Date created: 4.5.21.
 * Github: madjarevicn
 */
abstract contract ChainportUpgradables is Initializable {

    address public chainportCongress;
    IMaintainersRegistry public maintainersRegistry;

    // Only maintainer modifier
    modifier onlyMaintainer {
        require(maintainersRegistry.isMaintainer(msg.sender), "ChainportUpgradables: Restricted only to Maintainer");
        _;
    }

    // Only chainport congress modifier
    modifier onlyChainportCongress {
        require(msg.sender == chainportCongress, "ChainportUpgradables: Restricted only to ChainportCongress");
        _;
    }

    function setCongressAndMaintainers(
        address _chainportCongress,
        address _maintainersRegistry
    )
    internal
    {
        chainportCongress = _chainportCongress;
        maintainersRegistry = IMaintainersRegistry(_maintainersRegistry);
    }

    function setMaintainersRegistry(
        address _maintainersRegistry
    )
    public
    onlyChainportCongress
    {
        maintainersRegistry = IMaintainersRegistry(_maintainersRegistry);
    }
}
