/* eslint-disable max-depth */
import type { PathLike } from 'fs';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import frontMatter from 'gray-matter';
import { markdownToTxt } from 'markdown-to-txt';
import toc from 'markdown-toc';
import markdownTocUtils from 'markdown-toc/lib/utils';
import { basename, dirname, resolve } from 'path';
import readingTime from 'reading-time';
import { fileURLToPath } from 'url';

import type { Details, Result } from '@/types/scripts/build-posts-list';

import { addDocButtons, buildNavTree } from './build-docs';

const { slugify } = markdownTocUtils;

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = dirname(currentFilePath);

let specWeight = 100;
const finalResult: Result = {
  docs: [],
  blog: [],
  about: [],
  docsTree: {}
};
const releaseNotes: string[] = [];
const basePath = 'pages';
const postDirectories = [
  // order of these directories is important, as the blog should come before docs, to create a list of available release notes, which will later be used to release-note-link for spec docs
  [`${basePath}/blog`, '/blog'],
  [`${basePath}/docs`, '/docs'],
  [`${basePath}/about`, '/about']
];

function slugifyToC(str: string) {
  let slug;
  // Try to match heading ids like {# myHeadingId}
  const headingIdMatch = str.match(/[\s]?\{#([\w\d\-_]+)\}/);

  if (headingIdMatch && headingIdMatch.length >= 2) {
    [, slug] = headingIdMatch;
  } else {
    // Try to match heading ids like {<a name="myHeadingId"/>}
    const anchorTagMatch = str.match(/[\s]*<a[\s]+name="([\w\d\s\-_]+)"/);

    if (anchorTagMatch && anchorTagMatch.length >= 2) [, slug] = anchorTagMatch;
  }

  return slug || slugify(str, { firsth1: true, maxdepth: 6 });
}

function capitalize(text: string) {
  return text
    .split(/[\s-]/g)
    .map((word) => `${word[0].toUpperCase()}${word.substr(1)}`)
    .join(' ');
}

const addItem = (details: Details) => {
  if (!details.slug) {
    throw new Error('details.slug is required');
  }
  if (details.slug.startsWith('/docs')) finalResult.docs.push(details);
  else if (details.slug.startsWith('/blog')) finalResult.blog.push(details);
  else if (details.slug.startsWith('/about')) finalResult.about.push(details);
};

function isDirectory(dir: PathLike) {
  return statSync(dir).isDirectory();
}
function walkDirectories(
  directories: string[][],
  result: Result,
  sectionTitle?: string,
  sectionId?: string | undefined,
  rootSectionId?: string | undefined,
  sectionWeight = 0
) {
  for (const dir of directories) {
    const directory = dir[0];
    const sectionSlug = dir[1] || '';
    const files = readdirSync(directory);

    for (const file of files) {
      let details: Details;
      const fileName = [directory, file].join('/');
      const fileNameWithSection = [fileName, '_section.mdx'].join('/');
      const slug = fileName.replace(new RegExp(`^${basePath}`), '');
      const slugElements = slug.split('/');

      if (isDirectory(fileName)) {
        if (existsSync(fileNameWithSection)) {
          // Passing a second argument to frontMatter disables cache. See https://github.com/asyncapi/website/issues/1057
          details = frontMatter(readFileSync(fileNameWithSection, 'utf-8'), {}).data as Details;
          details.title = details.title || capitalize(basename(fileName));
        } else {
          details = {
            title: capitalize(basename(fileName))
          };
        }
        details.isSection = true;
        if (slugElements.length > 3) {
          details.parent = slugElements[slugElements.length - 2];
          details.sectionId = slugElements[slugElements.length - 1];
        }
        if (!details.parent) {
          details.isRootSection = true;
          details.rootSectionId = slugElements[slugElements.length - 1];
        }
        details.sectionWeight = sectionWeight;
        details.slug = slug;
        addItem(details);
        const rootId = details.parent || details.rootSectionId;

        walkDirectories([[fileName, slug]], result, details.title, details.sectionId, rootId, details.weight);
      } else if (file.endsWith('.mdx') && !fileName.endsWith('/_section.mdx')) {
        const fileContent = readFileSync(fileName, 'utf-8');
        // Passing a second argument to frontMatter disables cache. See https://github.com/asyncapi/website/issues/1057
        const { data, content } = frontMatter(fileContent, {});

        details = data as Details;
        details.toc = toc(content, { slugify: slugifyToC }).json;
        details.readingTime = Math.ceil(readingTime(content).minutes);
        details.excerpt = details.excerpt || markdownToTxt(content).substr(0, 200);
        details.sectionSlug = sectionSlug || slug.replace(/\.mdx$/, '');
        details.sectionWeight = sectionWeight;
        details.sectionTitle = sectionTitle;
        details.sectionId = sectionId;
        details.rootSectionId = rootSectionId;
        details.id = fileName;
        details.isIndex = fileName.endsWith('/index.mdx');
        details.slug = details.isIndex ? sectionSlug : slug.replace(/\.mdx$/, '');
        if (details.slug.includes('/reference/specification/') && !details.title) {
          const fileBaseName = basename(data.slug); // ex. v2.0.0 | v2.1.0-next-spec.1
          const fileNameOfBaseName = fileBaseName.split('-')[0]; // v2.0.0 | v2.1.0

          details.weight = specWeight--;

          if (fileNameOfBaseName.startsWith('v')) {
            details.title = capitalize(fileNameOfBaseName.slice(1));
          } else {
            details.title = capitalize(fileNameOfBaseName);
          }

          if (releaseNotes.includes(details.title)) {
            details.releaseNoteLink = `/blog/release-notes-${details.title}`;
          }

          if (fileBaseName.includes('next-spec') || fileBaseName.includes('next-major-spec')) {
            details.isPrerelease = true;
            // this need to be separate because the `-` in "Pre-release" will get removed by `capitalize()` function
            details.title += ' (Pre-release)';
          }
          if (fileBaseName.includes('explorer')) {
            details.title += ' - Explorer';
          }
        }

        // To create a list of available ReleaseNotes list, which will be used to add details.releaseNoteLink attribute.
        if (file.startsWith('release-notes') && dir[1] === '/blog') {
          const fileNameWithoutExtension = file.slice(0, -4);
          // removes the file extension. For example, release-notes-2.1.0.md -> release-notes-2.1.0
          const version = fileNameWithoutExtension.slice(fileNameWithoutExtension.lastIndexOf('-') + 1);

          // gets the version from the name of the releaseNote .md file (from /blog). For example, version = 2.1.0 if fileName_without_extension = release-notes-2.1.0
          releaseNotes.push(version);
          // releaseNotes is the list of all available releaseNotes
        }

        addItem(details);
      }
    }
  }
}

export async function buildPostList() {
  walkDirectories(postDirectories, finalResult);

  const filteredResult = finalResult.docs.filter((p: Details) => p.slug!.startsWith('/docs/'));
  const treePosts = buildNavTree(filteredResult);

  finalResult.docsTree = treePosts;
  finalResult.docs = addDocButtons(finalResult.docs, treePosts);
  if (process.env.NODE_ENV === 'production') {
    // console.log(inspect(result, { depth: null, colors: true }))
  }
  writeFileSync(resolve(currentDirPath, '..', 'config', 'posts.json'), JSON.stringify(finalResult, null, '  '));
}
