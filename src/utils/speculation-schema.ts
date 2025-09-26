"use client";

type SchemaType =
  | "NewsArticle"
  | "WebPage"
  | "Organization"
  | "Article"
  | "BlogPosting";

interface SchemaProps {
  type: SchemaType;
  headline?: string;
  url: string;
  thumbnailUrl?: URL;
  datePublished?: string;
  articleSection?: string;
  creator?: string | string[];
  keywords?: string[];
  name?: string;
  logo?: URL;
  sameAs?: string[];
}

export const generateSchema = (props: SchemaProps) => {
  const schema = {
    "@context": "https://schema.org",
    "@type": props.type,
    ...(props.headline && { headline: props.headline }),
    url: props.url,
    ...(props.thumbnailUrl && { thumbnailUrl: props.thumbnailUrl }),
    ...(props.datePublished && { datePublished: props.datePublished }),
    ...(props.articleSection && { articleSection: props.articleSection }),
    ...(props.creator && { creator: props.creator }),
    ...(props.keywords && { keywords: props.keywords }),
    ...(props.name && { name: props.name }),
    ...(props.logo && { logo: props.logo }),
    ...(props.sameAs && { sameAs: props.sameAs }),
  };

  return schema;
};
