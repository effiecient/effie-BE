import { ShareConfiguration } from "./shareConfiguration";

export type FolderData = {
  childrens?: {
    [key: string]: FolderData | LinkData;
  };
  isPinned: boolean;
  title: string;
  type: "folder";
  shareConfiguration?: ShareConfiguration;
};

type FolderAsChildrenField = {
  isPinned: boolean;
  title: string;
  type: "folder";
  shareConfiguration?: ShareConfiguration;
};

type LinkData = {
  isPinned: boolean;
  link: string;
  title: string;
  type: "link";
  shareConfiguration?: ShareConfiguration;
};
