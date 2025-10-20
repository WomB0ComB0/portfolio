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

type sizes =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | '11'
  | '12'
  | '14'
  | '16'
  | '20'
  | '24'
  | '28'
  | '32'
  | '36'
  | '40'
  | '44'
  | '48'
  | '52'
  | '56'
  | '60'
  | '64'
  | '72'
  | '80'
  | '96';

type SVGIconProps = {
  className?: string;
  props?: React.SVGProps<SVGSVGElement>;
  size?: sizes | '4';
};

type SVGIconParams = ({ className, size, props }: SVGIconProps) => JSX.Element;

type IconsProps = {
  logo: SVGIconParams;
  github: {
    gitHubStar: SVGIconParams;
    gitHubFork: SVGIconParams;
  };
};

type MetadataProps = {
  noIndex?: boolean;
  image?: string;
  icons?: string;
  title?: string;
  description?: string;
};

interface Messages {
  id: string;
  authorName: string;
  email: string;
  message: string;
  createdAt: Date;
}

interface LanyardResponse {
  discord_status?: string;
  discord_user?: {
    username: string;
    discriminator: string;
    id: string;
  };
}

type WakatimeStats = {
  text: string;
  total_seconds: number;
};
