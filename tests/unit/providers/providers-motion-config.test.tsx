/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @file The app's provider stack makes every `motion` component follow the operating system's
 * reduced-motion setting. Motion's own default is "never", which animates regardless.
 */

import { render, screen } from '@testing-library/react';
import { MotionConfigContext } from 'motion/react';
import { createContext, useContext } from 'react';
import { describe, expect, it } from 'vitest';

import { Providers } from '@/providers/providers';

const ReducedMotionProbe = () => {
  const { reducedMotion } = useContext(MotionConfigContext);
  return <p>reducedMotion: {reducedMotion ?? 'unset'}</p>;
};

const OuterContext = createContext('missing');
const OuterProbe = () => <p>outer: {useContext(OuterContext)}</p>;

describe('Providers', () => {
  it('sets motion to follow the reduced-motion setting of the operating system', () => {
    render(<Providers providers={[]} node={<ReducedMotionProbe />} />);

    expect(screen.getByText('reducedMotion: user')).toBeInTheDocument();
  });

  it('still renders the node inside the providers it was given', () => {
    render(
      <Providers
        providers={[[OuterContext.Provider, { value: 'provided' }]]}
        node={
          <>
            <OuterProbe />
            <ReducedMotionProbe />
          </>
        }
      />,
    );

    expect(screen.getByText('outer: provided')).toBeInTheDocument();
    expect(screen.getByText('reducedMotion: user')).toBeInTheDocument();
  });
});
