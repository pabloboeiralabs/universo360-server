import { Star, CheckCircle, Accessibility } from "lucide-react";
import { useParallax } from "@/hooks/useParallax";
import ScrollAnimatedElement from "@/components/ScrollAnimatedElement";
import domeImg from "@/assets/planetarium-dome.jpg";

const WhyChooseUs = () => {
  const imageOffset = useParallax({ speed: 0.1, direction: 'down' });
  
  const benefits = [
    {
      icon: Star,
      title: "Experiência Imersiva",
      description:
        "Nosso planetário móvel cria uma experiência visual impressionante que cativa e engaja os alunos.",
    },
    {
      icon: CheckCircle,
      title: "Conteúdo Personalizado",
      description:
        "Adaptamos nossas apresentações para atender às necessidades curriculares específicas de cada escola.",
    },
    {
      icon: Accessibility,
      title: "Acessibilidade",
      description:
        "Tornamos a astronomia acessível a todos os alunos.",
    },
  ];

  return (
    <section className="py-20 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            <ScrollAnimatedElement animation="fade-right">
              <h2 className="text-3xl md:text-4xl font-bold">
                Por Que Escolher Nosso Planetário?
              </h2>
            </ScrollAnimatedElement>

            <div className="space-y-6">
              {benefits.map((benefit, index) => (
                <ScrollAnimatedElement
                  key={index}
                  animation="fade-right"
                  delay={index * 150}
                >
                  <div className="flex gap-4 items-start">
                    <div className="feature-icon shrink-0">
                      <benefit.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1">
                        {benefit.title}
                      </h3>
                      <p className="text-foreground/90 text-sm">
                        {benefit.description}
                      </p>
                    </div>
                  </div>
                </ScrollAnimatedElement>
              ))}
            </div>
          </div>

          {/* Right Content - Dome Image with Parallax */}
          <ScrollAnimatedElement animation="fade-left" delay={200}>
            <div className="relative">
              <div className="rounded-xl">
                <img
                  src={domeImg}
                  alt="Domo do Planetário"
                  className="w-full rounded-xl"
                />
              </div>
              {/* Decorative gradient overlay */}
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-accent/20 rounded-3xl -z-10 blur-2xl opacity-50" />
            </div>
          </ScrollAnimatedElement>
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;
