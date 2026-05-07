import isotipo from '../../assets/brand/isotipo-urbaphix.svg';
import imagotipo from '../../assets/brand/imagotipo-urbaphix.svg';
import logotipo from '../../assets/brand/logotipo-urbaphix.svg';
import banner from '../../assets/brand/banner-urbaphix.svg';

const brandAssets = {
  isotipo,
  imagotipo,
  logotipo,
  banner
};

const defaultAlt = {
  isotipo: 'Isotipo Urbaphix',
  imagotipo: 'Imagotipo Urbaphix',
  logotipo: 'Logotipo Urbaphix',
  banner: 'Banner Urbaphix'
};

export default function BrandLogo({ variant = 'imagotipo', className = '', alt, decorative = false }) {
  const selectedVariant = brandAssets[variant] ? variant : 'imagotipo';

  return (
    <img
      src={brandAssets[selectedVariant]}
      alt={decorative ? '' : (alt || defaultAlt[selectedVariant])}
      aria-hidden={decorative || undefined}
      className={`block max-w-full object-contain ${className}`.trim()}
      loading="eager"
      decoding="async"
    />
  );
}
