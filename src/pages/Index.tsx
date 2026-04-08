import { useState } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import About from "@/components/About";
import WhyChooseUs from "@/components/WhyChooseUs";
import Gallery from "@/components/Gallery";
import Team from "@/components/Team";
import Footer from "@/components/Footer";
import VideoIntro from "@/components/VideoIntro";
import cosmicBg from "@/assets/cosmic-school-bg.png";
import WhatsAppButton from "@/components/WhatsAppButton";

const Index = () => {
  const [siteVisible, setSiteVisible] = useState(() => {
    return typeof window !== 'undefined' && localStorage.getItem('universo360_video_seen') === 'true';
  });
  const [forceVideo, setForceVideo] = useState(false);

  const handleReplayVideo = () => {
    setForceVideo(true);
  };

  return (
    <>
      <VideoIntro onComplete={() => setSiteVisible(true)} forceStart={forceVideo} onForceHandled={() => setForceVideo(false)} />
      <div className={`dark min-h-screen text-foreground overflow-x-hidden relative transition-opacity duration-500 ${siteVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        {/* Background image */}
        <div 
          className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${cosmicBg})` }}
        />
        <div className="fixed inset-0 -z-10 bg-background/30" />
        <Header />
        <main>
          <Hero onPlayVideo={handleReplayVideo} />
          <About />
          <WhyChooseUs />
          <Gallery />
          <Team />
        </main>
        <Footer />
        <WhatsAppButton />
      </div>
    </>
  );
};

export default Index;
