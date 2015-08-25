import React from 'react/addons';

import ModalContents from './ModalContents.js';
import Portal from '../Portal/Portal.js';

/**
 * Wrapper for the Modal, to put it inside of a Portal.
 * The Modal needs its own lifecycle and therefore this wrapper is necessary
 */

export default class Modal extends React.Component {

  render() {
    return (
      <Portal>
        <ModalContents {...this.props} />
      </Portal>
    );
  }
}
