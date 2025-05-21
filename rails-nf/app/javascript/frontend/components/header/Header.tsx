import { useStore } from '@nanostores/react';
import { chatStore } from '@stores/chat';
import { classNames } from '@utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { useLanggraphContext } from '@context/LanggraphContext';

export function Header() {
  const chat = useStore(chatStore);
  const { projectName } = useLanggraphContext();

  return (
    <header
      className={classNames(
        'flex items-center bg-bolt-elements-background-depth-1 p-5 border-b h-[var(--header-height)]',
        {
          'border-transparent': !chat.started,
          'border-bolt-elements-borderColor': chat.started,
        },
      )}
    >
      <div className="flex items-center gap-2 z-logo text-bolt-elements-textPrimary cursor-pointer">
        <div className="i-ph:sidebar-simple-duotone text-xl" />
        <a href="/" className="text-2xl font-semibold text-accent flex items-center">
          <span className="i-icons:logo-text?mask w-[46px] inline-block" />
        </a>
      </div>
      <span className="flex-1 px-4 truncate text-center text-bolt-elements-textPrimary">
        {projectName}
      </span>
      {chat.started && (
          <div className="mr-1">
            <HeaderActionButtons />
          </div>
      )}
    </header>
  );
}
