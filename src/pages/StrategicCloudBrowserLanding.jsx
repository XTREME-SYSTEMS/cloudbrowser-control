import React from "react";
import SiteHeader from "@/components/landing/SiteHeader";
import Hero from "@/components/landing/Hero";
import Pillars from "@/components/landing/Pillars";
import Services from "@/components/landing/Services";
import Process from "@/components/landing/Process";
import Testimonials from "@/components/landing/Testimonials";
import Team from "@/components/landing/Team";
import QuoteCTA from "@/components/landing/QuoteCTA";
import SiteFooter from "@/components/landing/SiteFooter";

export default function StrategicCloudBrowserLanding() {
  return (
    <div className="min-h-screen bg-white font-body antialiased" style={{ fontFamily: "'Inter', sans-serif" }}>
      <SiteHeader />
      <main>
        <Hero />
        <Pillars />
        <Services />
        <Process />
        <Team />
        <Testimonials />
        <QuoteCTA />
      </main>
      <SiteFooter />
    </div>
  );
}