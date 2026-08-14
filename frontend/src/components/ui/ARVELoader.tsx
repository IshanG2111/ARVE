import React from 'react';
import { Loader } from './Loader';
import type { LoaderProps } from './Loader';

export type ARVELoaderProps = LoaderProps;

export const ARVELoader: React.FC<ARVELoaderProps> = (props) => {
  return <Loader {...props} />;
};

export { Loader };
export default ARVELoader;
