// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

interface IERC5192 {
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);
    function locked(uint256 tokenId) external view returns (bool);
}

contract CoresID is ERC721, Ownable, IERC5192 {
    using Strings for uint256;

    uint256 public constant MAX_SEEDS = 5;

    mapping(address core => mapping(address seed => bool)) public isNominated;
    mapping(address seed => address core) public coreOfSeed;
    mapping(address core => uint256) public seedCount;
    mapping(address core => uint256) public pendingCount;
    mapping(address core => uint256) public coreTokenId;
    mapping(uint256 tokenId => address) public tokenCore;

    string public baseURI;
    uint256 public nextTokenId;

    event Nominated(address indexed core, address indexed seed);
    event NominationCancelled(address indexed core, address indexed seed);
    event Minted(address indexed core, address indexed seed, uint256 indexed level);

    error ZeroAddress();
    error MaxSeedsExceeded(address core);
    error SeedAlreadyNominated(address seed);
    error SeedAlreadyLinked(address seed);
    error NotNominated(address core, address seed);
    error AlreadyMinted(address seed, address core);
    error TokenIsSoulbound();
    error NoPendingNomination(address core, address seed);

    constructor(string memory baseURI_, address initialOwner)
        ERC721("CoresID", "CRID")
        Ownable(initialOwner)
    {
        baseURI = baseURI_;
    }

    function nominate(address[] calldata seeds) external {
        if (seeds.length == 0) revert ZeroAddress();
        if (pendingCount[msg.sender] + seedCount[msg.sender] + seeds.length > MAX_SEEDS) {
            revert MaxSeedsExceeded(msg.sender);
        }

        for (uint256 i; i < seeds.length;) {
            address seed = seeds[i];
            if (seed == address(0)) revert ZeroAddress();
            if (isNominated[msg.sender][seed]) revert SeedAlreadyNominated(seed);
            if (coreOfSeed[seed] != address(0)) revert SeedAlreadyLinked(seed);

            isNominated[msg.sender][seed] = true;
            emit Nominated(msg.sender, seed);

            unchecked {
                ++i;
            }
        }

        unchecked {
            pendingCount[msg.sender] += seeds.length;
        }
    }

    function cancelNomination(address seed) external {
        if (!isNominated[msg.sender][seed]) revert NoPendingNomination(msg.sender, seed);
        if (coreOfSeed[seed] == msg.sender) revert AlreadyMinted(seed, msg.sender);

        isNominated[msg.sender][seed] = false;
        unchecked {
            --pendingCount[msg.sender];
        }

        emit NominationCancelled(msg.sender, seed);
    }

    function mint(address core) external returns (uint256 tokenId) {
        if (!isNominated[core][msg.sender]) revert NotNominated(core, msg.sender);
        if (coreOfSeed[msg.sender] != address(0)) revert SeedAlreadyLinked(msg.sender);
        if (seedCount[core] >= MAX_SEEDS) revert MaxSeedsExceeded(core);

        isNominated[core][msg.sender] = false;
        coreOfSeed[msg.sender] = core;
        unchecked {
            --pendingCount[core];
            ++seedCount[core];
        }

        uint256 level = seedCount[core];

        if (level == 1) {
            tokenId = nextTokenId;
            unchecked { ++nextTokenId; }
            coreTokenId[core] = tokenId;
            tokenCore[tokenId] = core;
            _mint(core, tokenId);
            emit Locked(tokenId);
        } else {
            tokenId = coreTokenId[core];
        }

        emit Minted(core, msg.sender, level);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        address core = tokenCore[tokenId];
        uint256 level = seedCount[core];
        return string.concat(baseURI, level.toString(), ".json");
    }

    function setBaseURI(string calldata baseURI_) external onlyOwner {
        baseURI = baseURI_;
    }

    function totalSupply() external view returns (uint256) {
        return nextTokenId;
    }

    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == type(IERC5192).interfaceId || super.supportsInterface(interfaceId);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0)) revert TokenIsSoulbound();
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override { revert TokenIsSoulbound(); }
    function setApprovalForAll(address, bool) public pure override { revert TokenIsSoulbound(); }
}
