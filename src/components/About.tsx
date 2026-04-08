import { Star, Circle, FileText, Gift } from "lucide-react";
import ScrollAnimatedElement from "@/components/ScrollAnimatedElement";

const About = () => {
  const features = [
    {
      icon: Star,
      title: "Planetário",
      items: [
        "Domo móvel",
        "Ambiente Climatizado",
        "Capacidade 80 astronautas",
      ],
      color: "text-cosmic-cyan",
      bgColor: "bg-cosmic-cyan/10",
    },
    {
      icon: Circle,
      title: "360 Graus",
      items: [
        "Projeção em 360°",
        "Alta definição de som e imagem",
        "Experiência imersiva",
      ],
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: FileText,
      title: "Proposta",
      items: [
        "Ingressos individuais",
        "Custo zero para a escola",
      ],
      color: "text-foreground/70",
      bgColor: "bg-muted/20",
    },
    {
      icon: Gift,
      title: "Sorteio",
      items: [
        "Telescópio semi-profissional",
        "Astronauta projetor",
        "Outros",
      ],
      color: "text-amber-400",
      bgColor: "bg-amber-400/10",
    },
  ];

  return (
    <section
      id="projeto"
      className="relative py-20 overflow-hidden"
    >

      <div className="container mx-auto px-4 relative z-10">
        {/* Header Text */}
        <ScrollAnimatedElement animation="fade-up" className="text-center mb-16 max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Olá Astronauta!
            <br />
            <span className="text-gradient">Prepare-se para a decolagem.</span>
          </h2>
          <p className="text-foreground/90">
            Vamos juntos, explorar o universo em uma viagem inesquecível! O{" "}
            <span className="text-primary font-semibold">Planetário</span> traz
            para sua escola conhecimento, aprendizado e muita diversão em um
            cinema 360° de última geração. Embarque nessa aventura agora mesmo!
          </p>
        </ScrollAnimatedElement>

        {/* Features Grid */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {features.map((feature, index) => (
            <ScrollAnimatedElement 
              key={index}
              animation="fade-up"
              delay={index * 100}
            >
              <div className="glass-card-hover p-6 space-y-4 h-full">
                <div className={`w-12 h-12 rounded-xl ${feature.bgColor} flex items-center justify-center`}>
                  <feature.icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <h3 className="text-xl font-semibold">{feature.title}</h3>
                <ul className="space-y-2">
                  {feature.items.map((item, idx) => (
                    <li key={idx} className="text-sm text-foreground/90 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollAnimatedElement>
          ))}
        </div>
      </div>
    </section>
  );
};

export default About;
