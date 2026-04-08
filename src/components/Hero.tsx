import { Rocket, GraduationCap, Users, Play } from "lucide-react";
import ScrollAnimatedElement from "@/components/ScrollAnimatedElement";

const Hero = ({ onPlayVideo }: { onPlayVideo?: () => void }) => {
  const features = [
    {
      icon: Rocket,
      title: "Missões Interativas",
      description: "Aventuras espaciais emocionantes",
    },
    {
      icon: GraduationCap,
      title: "Aprendizado Divertido",
      description: "Descubra o cosmos",
    },
    {
      icon: Users,
      title: "Junte-se à Jornada",
      description: "Para crianças de todas as idades",
    },
  ];

  return (
    <section
      id="inicio"
      className="relative min-h-screen flex flex-col items-center justify-start overflow-hidden pt-20 md:pt-24 pb-32"
    >
      {/* Content */}
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
          <ScrollAnimatedElement animation="fade-up">
            <div className="space-y-6">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
                <span className="italic">Explore o Mar e o Universo</span>
                <br />
                <span className="text-gradient italic drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">Sem Sair da Sua Escola!</span>
              </h1>
            </div>
          </ScrollAnimatedElement>

          <ScrollAnimatedElement animation="fade-up" delay={200}>
            <button
              className="mt-28 sm:mt-36 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary/40 backdrop-blur-sm flex items-center justify-center hover:bg-primary/60 hover:scale-110 transition-all cursor-pointer"
              onClick={() => onPlayVideo?.()}
            >
              <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary-foreground ml-0.5" />
            </button>
          </ScrollAnimatedElement>

        </div>
      </div>

      {/* Subtitle - positioned above features bar */}
      <div className="absolute bottom-44 sm:bottom-32 md:bottom-36 left-0 right-0 z-10 text-center px-4">
        <ScrollAnimatedElement animation="fade-up" delay={300}>
          <p className="text-base sm:text-lg text-foreground/90 max-w-lg mx-auto">
            Junte-se a uma aventura além da imaginação.
            <br />
            Conhecimento, aprendizado e diversão em 360°.
          </p>
        </ScrollAnimatedElement>
      </div>

      {/* Bottom Features Bar */}
      <div className="absolute bottom-0 left-0 right-0 py-4 sm:py-6 bg-gradient-to-t from-background/90 to-transparent">
        <div className="container mx-auto px-4">
          <ScrollAnimatedElement animation="fade-up" delay={300}>
            <div className="glass-card p-3 sm:p-4 md:p-6 grid grid-cols-3 gap-2 sm:gap-4 md:gap-6">
              {features.map((feature, index) => (
                <div key={index} className="flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-4 text-center sm:text-left">
                  <div className="feature-icon shrink-0 w-10 h-10 sm:w-12 sm:h-12">
                    <feature.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-xs sm:text-sm md:text-base">{feature.title}</h3>
                    <p className="text-[10px] sm:text-sm text-foreground/90 hidden sm:block">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollAnimatedElement>
        </div>
      </div>
    </section>
  );
};

export default Hero;
