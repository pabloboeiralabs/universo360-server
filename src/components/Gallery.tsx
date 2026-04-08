import ScrollAnimatedElement from "@/components/ScrollAnimatedElement";
import gallery1 from "@/assets/gallery-new-1.png";
import gallery2 from "@/assets/gallery-new-2.png";
import gallery3 from "@/assets/gallery-new-3.png";
import gallery4 from "@/assets/gallery-new-4.png";

const Gallery = () => {
  const images = [
    { src: gallery1, alt: "Domo inflável do planetário na escola" },
    { src: gallery2, alt: "Crianças com trajes de astronauta" },
    { src: gallery3, alt: "Família com trajes espaciais Universo 360" },
    { src: gallery4, alt: "Planetário inflável iluminado no ginásio" },
  ];

  return (
    <section id="galeria" className="py-20">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <ScrollAnimatedElement animation="fade-up" className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-2">
            Nosso <span className="text-gradient">Universo</span> Visual
          </h2>
          <p className="text-foreground/90 max-w-xl mx-auto">
            Explore as imagens das nossas viagens espaciais e da tecnologia que
            levamos até as escolas.
          </p>
        </ScrollAnimatedElement>

        {/* Gallery Grid - 2x2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {images.map((image, index) => (
            <ScrollAnimatedElement
              key={index}
              animation="scale"
              delay={index * 100}
            >
              <div className="glass-card-hover overflow-hidden group cursor-pointer">
                <div className="relative overflow-hidden rounded-xl">
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="w-full h-64 sm:h-80 md:h-96 object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                    <span className="text-sm font-medium">{image.alt}</span>
                  </div>
                </div>
              </div>
            </ScrollAnimatedElement>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Gallery;
