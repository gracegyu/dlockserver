import { FlakeId } from '@nerimity/flakeid';

const _flake = new FlakeId({
  mid: 42, //optional, define machine id
  timeOffset: (2013 - 1970) * 31536000 * 1000, //optional, define a offset time
});
export function flakeGen(): string {
  return _flake.gen();
}
