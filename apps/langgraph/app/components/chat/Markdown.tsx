import { memo, useMemo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import type { BundledLanguage } from 'shiki';
import { createScopedLogger } from '~/lib/utils/logger';
import { rehypePlugins, remarkPlugins, allowedHTMLElements } from '~/lib/utils/markdown';
import { Artifact } from './Artifact';
import { CodeBlock } from './CodeBlock';
import { workbenchStore } from '~/lib/stores/workbench';
import styles from './Markdown.module.scss';

const logger = createScopedLogger('MarkdownComponent');

interface MarkdownProps {
  children: string;
  html?: boolean;
  limitedMarkdown?: boolean;
  showChanges?: boolean;
}

export const Markdown = memo(({ children, html = false, limitedMarkdown = false, showChanges = false }: MarkdownProps) => {
  logger.trace('Render');
  const currentArtifactId = workbenchStore.currentArtifactId.get();

  const components = useMemo(() => {
    return {
      div: ({ className, children, node, ...props }) => {
        return (
          <div className={className} {...props}>
            {children}
          </div>
        );
      },
      pre: (props) => {
        const { children, node, ...rest } = props;

        const [firstChild] = node?.children ?? [];

        if (
          firstChild &&
          firstChild.type === 'element' &&
          firstChild.tagName === 'code' &&
          firstChild.children[0].type === 'text'
        ) {
          const { className, ...rest } = firstChild.properties;
          const [, language = 'plaintext'] = /language-(\w+)/.exec(String(className) || '') ?? [];

          return <CodeBlock code={firstChild.children[0].value} language={language as BundledLanguage} {...rest} />;
        }

        return <pre {...rest}>{children}</pre>;
      },
    } satisfies Components;
  }, []);

  return (
    <div className={styles.MarkdownContent}>
      <ReactMarkdown
        allowedElements={allowedHTMLElements}
        components={components}
        remarkPlugins={remarkPlugins(limitedMarkdown)}
        rehypePlugins={rehypePlugins(html)}
      >
        {children}
      </ReactMarkdown>
      {
        showChanges && currentArtifactId && <Artifact messageId={currentArtifactId} />
      }
    </div>
  );
});
