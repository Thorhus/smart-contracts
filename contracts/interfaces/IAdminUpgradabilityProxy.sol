pragma solidity ^0.6.12;

/**
 * IAdminUpgradabilityProxy contract.
 * @author Nikola Madjarevic
 * Date created: 3.5.21.
 * Github: madjarevicn
 */
interface IAdmin {
    function getProxyImplementation(address proxy) external view returns (address);
}
