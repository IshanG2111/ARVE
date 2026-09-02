import React from 'react';
import { Spiral } from './spiral';
import type { SpiralProps } from './spiral';

export type LoaderProps = SpiralProps;

export const Loader: React.FC<LoaderProps> = (props) => {
  return <Spiral {...props} />;
};

export const ARVELoader = Loader;
export default Loader;
