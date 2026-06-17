import { useRef, useState } from "react";
import { NetworkOptions } from "./NetworkOptions";
import { getAddress } from "viem";
import { Address } from "viem";
import { useAccount, useDisconnect } from "wagmi";
import {
  ArrowLeftOnRectangleIcon,
  ArrowTopRightOnSquareIcon,
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  DocumentDuplicateIcon,
  EyeIcon,
  QrCodeIcon,
} from "@heroicons/react/24/outline";
import { BlockieAvatar } from "~~/components/scaffold-eth";
import { useCopyToClipboard, useOutsideClick } from "~~/hooks/scaffold-eth";
import { getTargetNetworks } from "~~/utils/scaffold-eth";
import { isENS } from "~~/utils/scaffold-eth/common";

const BURNER_WALLET_ID = "burnerWallet";

const allowedNetworks = getTargetNetworks();

type AddressInfoDropdownProps = {
  address: Address;
  blockExplorerAddressLink: string | undefined;
  displayName: string;
  ensAvatar?: string;
};

export const AddressInfoDropdown = ({
  address,
  ensAvatar,
  displayName,
  blockExplorerAddressLink,
}: AddressInfoDropdownProps) => {
  const { disconnect } = useDisconnect();
  const { connector } = useAccount();
  const checkSumAddress = getAddress(address);

  const { copyToClipboard: copyAddressToClipboard, isCopiedToClipboard: isAddressCopiedToClipboard } =
    useCopyToClipboard();
  const [selectingNetwork, setSelectingNetwork] = useState(false);
  const dropdownRef = useRef<HTMLDetailsElement>(null);

  const closeDropdown = () => {
    setSelectingNetwork(false);
    dropdownRef.current?.removeAttribute("open");
  };

  useOutsideClick(dropdownRef, closeDropdown);

  return (
    <>
      <details ref={dropdownRef} className="dropdown dropdown-end leading-3">
        <summary className="flex items-center gap-1.5 border border-slate-200 bg-white hover:border-slate-400 px-2 py-1.5 cursor-pointer transition-colors h-auto! list-none">
          <BlockieAvatar address={checkSumAddress} size={30} ensImage={ensAvatar} />
          <span className="font-mono text-xs text-slate-700 ml-1.5 mr-0.5">
            {isENS(displayName) ? displayName : checkSumAddress?.slice(0, 6) + "…" + checkSumAddress?.slice(-4)}
          </span>
          <ChevronDownIcon className="h-3.5 w-3.5 text-slate-400" />
        </summary>
        <ul className="dropdown-content menu z-[100] p-1 mt-1 shadow-lg bg-white border border-slate-200 rounded-none gap-0 min-w-48">
          <NetworkOptions hidden={!selectingNetwork} />
          <li className={selectingNetwork ? "hidden" : ""}>
            <div
              className="flex items-center gap-2 px-3 py-2 text-xs font-mono text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
              onClick={() => copyAddressToClipboard(checkSumAddress)}
            >
              {isAddressCopiedToClipboard ? (
                <>
                  <CheckCircleIcon className="text-xl font-normal h-6 w-4 ml-2 sm:ml-0" aria-hidden="true" />
                  <span className="whitespace-nowrap">Copied!</span>
                </>
              ) : (
                <>
                  <DocumentDuplicateIcon className="text-xl font-normal h-6 w-4 ml-2 sm:ml-0" aria-hidden="true" />
                  <span className="whitespace-nowrap">Copy address</span>
                </>
              )}
            </div>
          </li>
          <li className={selectingNetwork ? "hidden" : ""}>
            <label
              htmlFor="qrcode-modal"
              className="flex items-center gap-2 px-3 py-2 text-xs font-mono text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <QrCodeIcon className="h-4 w-4" />
              <span className="whitespace-nowrap">View QR Code</span>
            </label>
          </li>
          <li className={selectingNetwork ? "hidden" : ""}>
            <button
              className="flex items-center gap-2 px-3 py-2 text-xs font-mono text-slate-600 hover:bg-slate-50 w-full transition-colors"
              type="button"
            >
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              <a
                target="_blank"
                href={blockExplorerAddressLink}
                rel="noopener noreferrer"
                className="whitespace-nowrap"
              >
                View on Block Explorer
              </a>
            </button>
          </li>
          {allowedNetworks.length > 1 ? (
            <li className={selectingNetwork ? "hidden" : ""}>
              <button
                className="flex items-center gap-2 px-3 py-2 text-xs font-mono text-slate-600 hover:bg-slate-50 w-full transition-colors"
                type="button"
                onClick={() => setSelectingNetwork(true)}
              >
                <ArrowsRightLeftIcon className="h-4 w-4" /> <span>Switch Network</span>
              </button>
            </li>
          ) : null}
          {connector?.id === BURNER_WALLET_ID ? (
            <li>
              <label
                htmlFor="reveal-burner-pk-modal"
                className="flex items-center gap-2 px-3 py-2 text-xs font-mono text-red-500 hover:bg-red-50 cursor-pointer transition-colors"
              >
                <EyeIcon className="h-4 w-4" />
                <span>Reveal Private Key</span>
              </label>
            </li>
          ) : null}
          <li className={selectingNetwork ? "hidden" : ""}>
            <button
              className="flex items-center gap-2 px-3 py-2 text-xs font-mono text-red-500 hover:bg-red-50 w-full transition-colors"
              type="button"
              onClick={() => disconnect()}
            >
              <ArrowLeftOnRectangleIcon className="h-4 w-4" /> <span>Disconnect</span>
            </button>
          </li>
        </ul>
      </details>
    </>
  );
};
