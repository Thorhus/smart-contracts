pragma solidity ^0.6.12;

import "./libraries/SafeMath.sol";

contract MaintainersRegistry {

    using SafeMath for uint;

    string constant _isMaintainer = "isMaintainer";
    string constant _idToMaintainer = "idToMaintainer";
    string constant _numberOfMaintainers = "numberOfMaintainers";
    string constant _numberOfActiveMaintainers = "numberOfActiveMaintainers";

    mapping(bytes32 => uint) uintStorage;
    mapping(bytes32 => address) addressStorage;
    mapping(bytes32 => bool) boolStorage;

    bool initialized;

    function setInitialParams(
        //address _twoKeySingletonRegistry,
        address [] _maintainers
        //address [] _coreDevs
    )
    public
    {
        require(initialized == false);

        addMaintainer(msg.sender);

        for(uint i = 0; i < _maintainers.length; i++) {
            addMaintainer(_maintainers[i]);
        }

        initialized = true;

    }

    function addMaintainer(
        address _maintainer
    )
    internal
    {
        bytes32 keyHashIsMaintainer = keccak256(_isMaintainer, _maintainer);

        uint id = getNumberOfMaintainers();

        bytes32 keyHashIdToMaintainer = keccak256(_idToMaintainer, id);

        incrementNumberOfMaintainers();

        incrementNumberOfActiveMaintainers();

        addressStorage[keyHashIdToMaintainer] = _maintainer;
        boolStorage[keyHashIsMaintainer] = true;

    }

    function removeMaintainer(
        address _maintainer
    )
    internal
    {
        bytes32 keyHashIsMaintainer = keccak256(_isMaintainer, _maintainer);
        decrementNumberOfActiveMaintainers();
        boolStorage[keyHashIsMaintainer] = false;
    }

    function incrementNumberOfMaintainers() internal {
        uint numberOfMaintainers = uintStorage[keccak256(_numberOfMaintainers)];
        numberOfMaintainers.add(1);
        uintStorage[keccak256(_numberOfMaintainers)] = numberOfMaintainers;
    }

    function incrementNumberOfActiveMaintainers() internal {
        uint numberOfActiveMaintainers = uintStorage[keccak256(_numberOfActiveMaintainers)];
        numberOfActiveMaintainers.add(1);
        uintStorage[keccak256(_numberOfActiveMaintainers)] = numberOfActiveMaintainers;
    }

    function decrementNumberOfActiveMaintainers() internal {
        uint numberOfActiveMaintainers = uintStorage[keccak256(_numberOfActiveMaintainers)];
        numberOfActiveMaintainers.sub(1);
        uintStorage[keccak256(_numberOfActiveMaintainers)] = numberOfActiveMaintainers;
    }

    function isAddressMaintainer(
        address _address
    )
    public
    view
    returns(bool)
    {
        return boolStorage[keccak256(_isMaintainer, _address)];
    }

    function getNumberOfMaintainers()
    public
    view
    returns (uint)
    {
        return uintStorage[keccak256(_numberOfMaintainers)];
    }

    function getAllMaintainers()
    public
    view
    returns (address[])
    {
        uint numberOfMaintainersTotal = getNumberOfMaintainers();
        uint numberOfActiveMaintainers = getNumberOfActiveMaintainers();
        address [] memory activeMaintainers = new Address[](numberOfActiveMaintainers);

        uint counter = 0;
        for(uint i=0; i < numberOfMaintainersTotal; i++) {
            address maintainer = getMaintainerPerId(i);
            if(isMaintainer(maintainer)){
                activeMaintainers[counter] = maintainer;
                counter = counter.add(1);
            }
        }

        return activeMaintainers;
    }

    function getMaintainerById(
        uint _id
    )
    public
    view
    returns (address)
    {
        return addressStorage[keccak256(_idToMaintainer, _id)];
    }
}
