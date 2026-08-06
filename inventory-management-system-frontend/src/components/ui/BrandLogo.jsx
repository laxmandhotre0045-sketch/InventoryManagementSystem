import { Box } from '@mui/material';

/**
 * The SensoVibe wordmark — single source of truth for brand artwork.
 *
 * Swapping the logo means changing LOGO_SRC here and nothing else.
 *
 * The supplied file is a JPEG, so it has no alpha channel: its background is
 * solid white. On the white sidebar that is invisible, but the login panel and
 * the module picker sit on warm off-white, where a plain <img> would show as a
 * white rectangle around the mark. `mix-blend-mode: multiply` drops the white
 * away on any light surface without touching the artwork itself — no tracing,
 * no re-export, the raster is used exactly as provided.
 *
 * Replace LOGO_SRC with a transparent PNG and set `blend={false}` if one is
 * supplied later; nothing else needs to change.
 */
const LOGO_SRC = '/sensovibe-logo.jpg';

/** Intrinsic pixel size of the artwork — used to reserve space and stop layout shift. */
const NATURAL_WIDTH = 800;
const NATURAL_HEIGHT = 159;
const ASPECT = `${NATURAL_WIDTH} / ${NATURAL_HEIGHT}`;

const BrandLogo = ({
  /** Rendered height in px; width follows the natural aspect ratio. */
  height,
  /** Or constrain by width instead (accepts any CSS length / clamp()). */
  width,
  blend = true,
  sx,
  ...rest
}) => (
  <Box
    component="img"
    src={LOGO_SRC}
    alt="SensoVibe"
    width={NATURAL_WIDTH}
    height={NATURAL_HEIGHT}
    decoding="async"
    sx={{
      display: 'block',
      aspectRatio: ASPECT,
      ...(height ? { height, width: 'auto' } : {}),
      ...(width ? { width, height: 'auto' } : {}),
      maxWidth: '100%',
      // Keeps the wordmark crisp when the browser scales the raster down.
      imageRendering: 'auto',
      ...(blend ? { mixBlendMode: 'multiply' } : {}),
      ...sx,
    }}
    {...rest}
  />
);

export { LOGO_SRC };
export default BrandLogo;
