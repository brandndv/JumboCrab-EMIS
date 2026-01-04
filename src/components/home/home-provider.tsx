import Hero from "./hero";
import HomeHeader from "./home-header";
import FeatureStrip from "./feature-strip";
import SignatureDishes from "./signature-dishes";
import GuestReviews from "./guest-reviews";

const HomeProvider = () => {
  return (
    <div>
      <HomeHeader />
      <Hero />
      <FeatureStrip />
      <SignatureDishes />
      <GuestReviews />
    </div>
  );
};

export default HomeProvider;
