import { PropsWithChildren } from "react";
import { useLaunch } from "@tarojs/taro";
import { initStore } from "./shared/store";
import { wxLogin, isLoggedIn } from "./shared/auth";

import "./app.scss";

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    initStore();

    if (!isLoggedIn()) {
      wxLogin().catch((err) => {
        console.warn("[App] auto-login failed:", err);
      });
    }
  });

  return children;
}

export default App;
